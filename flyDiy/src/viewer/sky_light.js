// ============================================================
// THE SKY'S LIGHT — the day applied to a room's rig (SKY S3, 2026-09-14).
//
// One function, both rooms: the world and the shed hand it their key
// light, their hemisphere and their scene, and it writes what the DAY says
// through the atmosphere - never around light_rig.js (SKY ruling (af)):
//
//   the KEY      the ONE DirectionalLight is the sun, and below the horizon
//                the MOON (hysteresis across -0.5..-1.2 deg, so twilight
//                does not flicker); colour = the transmittance along the
//                light's own path, normalised; intensity = K x max(T) x the
//                room's unit x the moon's ratio when it is the moon
//   the HEMI     the sky's irradiance (ATMO.skyIrradiance, sun + moon) in
//                colour and level; the ground term follows the light
//   the DOME     ATMO.U.scale = the same K x unit, so the dome's radiance
//                and the terrain it meets are lit on one scale
//   the EXPOSURE light_rig.exposureFor(sunEl) x the row's factor, declared
//                as a BASE through GFX.setExposure (never read back)
//
// CALIBRATION. K is fitted ONCE so that the alps afternoon the user judged
// (render_world's row: sun 2.8, hemisphere 0.274 at 33.4 deg, exposure
// 0.92) comes out of the model unchanged: K_SUN = 2.8 / max T(33.4 deg),
// K_HEMI = 0.274 / lum E_sky(33.4 deg). Every other hour is then the
// physics, and light_rig's schedule opens the exposure through the
// twilight. The rows' `sunI`/`hemi` become GAINS on those anchors (the
// island's doubled hemisphere is a hemiBoost of 2).
// ============================================================
var SKY_LIGHT = (function () {
  'use strict';
  const D2R = Math.PI / 180;
  const REF_EL = 33.4, REF_SUN = 2.8, REF_HEMI = 0.274;
  let K_SUN = null, K_HEMI = null;
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const maxc = c => Math.max(c[0], c[1], c[2], 1e-6);
  function calibrate() {
    if (typeof ATMO === 'undefined') return false;
    const s = Math.sin(REF_EL * D2R), c = Math.cos(REF_EL * D2R);
    K_SUN = REF_SUN / maxc(ATMO.sunTransmittance(0, s, [0, 0, 0]));
    K_HEMI = REF_HEMI / Math.max(1e-6, lum(ATMO.skyIrradiance(0, [0, s, c])));
    return true;
  }
  const _T = [0, 0, 0], _E = [0, 0, 0], _Em = [0, 0, 0];
  let isMoon = false, lastEx = -1;

  // applyDay(day, o): o = { key, hemi, scene, renderer, unit (LIGHT_UNIT or 1), roomGain, sunGain, hemiBoost,
  //                         gndAlb (the world's mean albedo, linear rgb - the ground half is derived from it),
  //                         gndGain, hemiGnd (hex, the fallback when there is no albedo),
  //                         gb (ground bounce), exposureK, altM }
  // returns { isMoon, el, exposure, sunI, hemiI }
  const _c3 = (typeof THREE !== 'undefined' && THREE.Color) ? new THREE.Color() : { setRGB() { return this; } };
  // groundHalf(key, hemi, dirY, alb, gb, gain) -> true when it wrote the ground term.
  // ONE implementation of the derivation documented at its call site: both the day's pass and a
  // MANUAL rig row (render_world rigApply, where the sliders place the sun by hand and applyDay
  // never runs) must get the same answer, so neither of them owns the arithmetic.
  function groundHalf(key, hemi, dirY, alb, gb, gain) {
    if (!key || !hemi || !hemi.groundColor || !hemi.groundColor.setRGB || !alb) return false;
    if (!(alb[0] + alb[1] + alb[2] > 0)) return false;
    const gg = (gb != null ? gb : 1) * (gain != null ? gain : 1);
    const hI = Math.max(1e-9, hemi.intensity), kI = key.intensity * Math.max(0, dirY);
    const kc = key.color, sc = hemi.color;
    const c = v => Math.min(4, Math.max(0, v));       // a ground brighter than 4x the sky is snow at noon, and past that it is a bug
    hemi.groundColor.setRGB(c(alb[0] * (kc.r * kI + sc.r * hI) / hI * gg),
                            c(alb[1] * (kc.g * kI + sc.g * hI) / hI * gg),
                            c(alb[2] * (kc.b * kI + sc.b * hI) / hI * gg));
    API.gnd = [hemi.groundColor.r, hemi.groundColor.g, hemi.groundColor.b];
    return true;
  }
  function applyDay(day, o) {
    if (!day || typeof ATMO === 'undefined') return null;
    if (K_SUN == null && !calibrate()) return null;
    const unit = o.unit || 1, gain = (o.roomGain || 1) * (o.sunGain || 1), altKm = (o.altM || 0) / 1000;
    const el = day.sunEl, sun = day.sun, moon = day.moon;
    // the light: sun or moon, with hysteresis
    if (!isMoon && el < -1.2) isMoon = true; else if (isMoon && el > -0.5) isMoon = false;
    const moonE = (typeof LIGHT_RIG !== 'undefined' ? LIGHT_RIG.MOON_RATIO : 2.5e-6) * day.moonPhase;
    const dir = isMoon ? moon : sun;
    const key = o.key;
    if (key) {
      ATMO.sunTransmittance(altKm, dir[1], _T);
      const mT = maxc(_T);
      // the sun fades through the horizon (its own transmittance does most of it)
      const fade = isMoon ? (moon[1] > -0.02 ? 1 : 0) : Math.min(1, Math.max(0, (el + 1.5) / 2));
      let I = K_SUN * mT * unit * gain * fade;
      if (isMoon) I *= moonE;
      if (o.keyGain != null && !isMoon) I *= o.keyGain;   // the key alone (CLOUDS C3: the layer's transmittance over a room - the dome keeps its scale)
      key.intensity = I;
      if (key.color && key.color.setRGB) {
        if (isMoon) key.color.setRGB(0.92 * _T[0] / mT, 0.96 * _T[1] / mT, _T[2] / mT);
        else key.color.setRGB(_T[0] / mT, _T[1] / mT, _T[2] / mT);
      }
      if (key.position && key.target) {
        // the world places the key by SUN each frame (its shadow follow); a room that does not gets it here
        if (o.placeKey) { const R = o.keyDist || 700; key.position.set(key.target.position.x + dir[0] * R, key.target.position.y + dir[1] * R, key.target.position.z + dir[2] * R); }
      }
      if (key.shadow) key.shadow.intensity = Math.min(1, Math.max(0, (Math.asin(Math.max(-1, Math.min(1, dir[1]))) / D2R - 2) / 4));
    }
    // the hemisphere: the sky's irradiance from both lights
    const hemi = o.hemi;
    if (hemi) {
      ATMO.skyIrradiance(altKm, sun, _E);
      if (moonE > 0 && moon[1] > -0.1) { ATMO.skyIrradiance(altKm, moon, _Em); _E[0] += _Em[0] * moonE; _E[1] += _Em[1] * moonE; _E[2] += _Em[2] * moonE; }
      const L = Math.max(1e-9, lum(_E)), mE = maxc(_E);
      const boost = o.hemiBoost != null ? o.hemiBoost : 1;
      // a floor: starlight and airglow, so a moonless night is not black (1e-7 of noon, x the night's 14 stops = a whisper)
      hemi.intensity = Math.max(K_HEMI * L * unit * boost, 3e-7 * unit);
      if (hemi.color && hemi.color.setRGB) {
        hemi.color.setRGB(_E[0] / mE, _E[1] / mE, _E[2] / mE);
        // CLOUDS C3: under a cloud the sky's light is the deck's (the sun's transmitted colour diffused), not the zenith's blue
        if (o.cloudT != null && o.cloudT < 1 && !isMoon) { const mT = maxc(_T), w = 0.6 * (1 - Math.max(0, o.cloudT)); hemi.color.lerp(_c3.setRGB(_T[0] / mT, _T[1] / mT, _T[2] / mT), w); }
      }
      // ---- THE GROUND HALF IS THE WORLD'S ALBEDO x WHAT FALLS ON IT (2026-09-22) ----
      // It was a hex per rig row (island 0x3a3f30, alps 0x343422): a colour somebody chose, fixed
      // against the sky through every hour, and the last authored green in the rig. It is derived
      // now, and the derivation needs no new physics because three renders both terms in the same
      // units: a hemisphere's ground irradiance is groundColor x intensity, its sky irradiance is
      // skyColor x intensity, and a directional's on a horizontal surface is colour x intensity x
      // max(0, dir.y). So what the GROUND receives is
      //     E_total = keyColour x keyIntensity x max(0, dir.y)  +  skyColour x hemiIntensity
      // and what it hands back upward is albedo x E_total, which in groundColor's own units is
      //     groundColor = albedo (x) E_total / hemiIntensity  x gb x gain.
      // Two checks the arithmetic must pass: a white ground (albedo 1) under no sun gives exactly
      // the sky colour back, and the whole thing carries the moon, the horizon fade, the cloud
      // transmittance and the hemisphere's boost for free, because they are already in the two
      // lights. THE SHAPE OF THE RESULT: at noon the bounce is several times the sky term (the sun
      // is what lights the ground); through dusk it falls to albedo x sky, faster than the sky
      // itself - which the fixed hex could not do, it tracked the sky exactly at every hour.
      // gb (LIGHT_RIG.groundBounce) is still the occlusion, and it is still a judgement: an
      // unoccluded hemisphere of lit ground is right for an aeroplane over an open field and
      // generous for a valley floor or a forest.
      if (groundHalf(key, hemi, dir[1], o.gndAlb, o.gb, o.gndGain)) { /* derived (one implementation, below) */ }
      else if (hemi.groundColor && hemi.groundColor.setHex && o.hemiGnd != null) {
        // no world albedo (no imagery and no classifier - the bench's stub scenes): the row's hex
        hemi.groundColor.setHex(o.hemiGnd).multiplyScalar(o.gb != null ? o.gb : 1);
        API.gnd = [hemi.groundColor.r, hemi.groundColor.g, hemi.groundColor.b];
      }
    }
    // the dome's scale: the same K, the same unit
    if (ATMO.U && ATMO.U.scale) ATMO.U.scale.value = K_SUN * unit * gain;
    // the exposure: the schedule, as a base
    // the schedule adapts the eye to the SKY; a room with lamps adapts to its lamps once the sky
    // is darker than they are - o.exposureCap is the exposure those lamps were judged at
    let ex = (typeof LIGHT_RIG !== 'undefined' ? LIGHT_RIG.exposureFor(el, o.exposureK) : 0.92);
    if (o.exposureCap != null) ex = Math.min(ex, o.exposureCap);
    if (o.renderer) {
      // against the LIVE base (two rooms share one renderer and each writes on entry), never a memory of our own
      const G = (typeof window !== 'undefined') ? window.GFX : null;
      const cur = (G && G.exposureBase && G.exposureBase() != null) ? G.exposureBase() : lastEx;
      if (Math.abs(ex - cur) > Math.max(1e-6, cur * 0.01)) {
        lastEx = ex;
        if (G && G.setExposure) G.setExposure(o.renderer, ex); else o.renderer.toneMappingExposure = ex;
      }
    }
    API.last = { isMoon, el, T: [_T[0], _T[1], _T[2]], phase: day.moonPhase };   // the flare reads the light's transmitted colour
    return { isMoon, el, exposure: ex, sunI: key ? key.intensity : 0, hemiI: hemi ? hemi.intensity : 0 };
  }
  const API = { applyDay, groundHalf, calibrate, K: () => ({ K_SUN, K_HEMI }), get isMoon() { return isMoon; }, resetExposure: () => { lastEx = -1; }, last: null,
                gnd: null };   // the ground half as last derived (linear rgb) - the F8 readout and GATE LIGHT read it
  if (typeof window !== 'undefined') window.SKY_LIGHT = API;
  return API;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SKY_LIGHT;
