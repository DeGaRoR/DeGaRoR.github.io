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
  //                         hemiGnd (hex), gb (ground bounce), exposureK, altM }
  // returns { isMoon, el, exposure, sunI, hemiI }
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
      if (hemi.color && hemi.color.setRGB) hemi.color.setRGB(_E[0] / mE, _E[1] / mE, _E[2] / mE);
      if (hemi.groundColor && hemi.groundColor.setHex && o.hemiGnd != null) {
        hemi.groundColor.setHex(o.hemiGnd).multiplyScalar(o.gb != null ? o.gb : 1);
      }
    }
    // the dome's scale: the same K, the same unit
    if (ATMO.U && ATMO.U.scale) ATMO.U.scale.value = K_SUN * unit * gain;
    // the exposure: the schedule, as a base
    const ex = (typeof LIGHT_RIG !== 'undefined' ? LIGHT_RIG.exposureFor(el, o.exposureK) : 0.92);
    if (o.renderer && Math.abs(ex - lastEx) > lastEx * 0.01) {
      lastEx = ex;
      if (typeof window !== 'undefined' && window.GFX && window.GFX.setExposure) window.GFX.setExposure(o.renderer, ex);
      else o.renderer.toneMappingExposure = ex;
    }
    return { isMoon, el, exposure: ex, sunI: key ? key.intensity : 0, hemiI: hemi ? hemi.intensity : 0 };
  }
  const API = { applyDay, calibrate, K: () => ({ K_SUN, K_HEMI }), get isMoon() { return isMoon; }, resetExposure: () => { lastEx = -1; } };
  if (typeof window !== 'undefined') window.SKY_LIGHT = API;
  return API;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SKY_LIGHT;
