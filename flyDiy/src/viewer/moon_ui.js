// moon_ui.js - THE NIGHT'S DIALS (G2600 MOONLIGHT, 2026-10-08)
//
// The user: "can we have some full moon nights, where it's possible to see something, so VFR at night, even
// though super dangerous, becomes somehow possible?" The light itself is light_rig.js's (THE NIGHT: the phase
// law, the night eye's grade, the night stops) and sky_light.js's (the moon as the key); this file only puts
// light_rig's NIGHT table and the atmosphere's star gain on the left rail's NIGHT section (app.js night(), under
// the day panel - day_ui.js is SIM-CLOCK's), one row a dial, double-click on its name back to the resting value,
// and keeps them (localStorage flydiy.night.v1) so a judged night survives a reload. Nothing here is drawn or
// computed per frame: a dial writes a number the next applyDay reads (the grade's uniforms, the exposure's base
// eases on LIGHT-SMOOTH's clock, the moon's light through the same ease).
var MOON_UI = (function () {
  'use strict';
  const W = (typeof window !== 'undefined') ? window : null;
  const KEY = 'flydiy.night.v1';
  const LR = () => (W && W.LIGHT_RIG) || null;
  const STARS_DEF = 1;
  const stars = () => (W && W.ATMO && W.ATMO.U && W.ATMO.U.stars) ? W.ATMO.U.stars.value : NaN;
  const setStars = v => { if (W && W.ATMO && W.ATMO.U && W.ATMO.U.stars) W.ATMO.U.stars.value = v; };
  // the day re-applied at the next frame, so a dial is seen while it is dragged (the world's guard otherwise waits for the
  // sun to move; WORLD.relight drops the guard without bumping the day's version - the atmosphere's tables stay)
  const kick = () => { try { if (W.WORLD && W.WORLD.relight) W.WORLD.relight(); } catch (e) {} };
  function save() {
    const L = LR(); if (!L) return;
    try { const o = L.night(); const s = stars(); if (isFinite(s)) o.stars = s; W.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function load() {
    const L = LR(); if (!L || !W) return;
    try { const o = JSON.parse(W.localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { L.setNight(o); if (typeof o.stars === 'number') setStars(o.stars); } } catch (e) {}
  }
  // the rows: [key, label, lo, hi, step, readout, what it is]
  const DIALS = [
    ['moon', 'moonlight', 0, 3, 0.05, v => v.toFixed(2) + 'x', 'the moon\'s light over the physical full moon (0.25 lux); the phase law and the sky\'s transmittance stay the physics'],
    ['eye', 'night eye', -1, 3, 0.1, v => (v > 0 ? '+' : '') + v.toFixed(1) + ' stops', 'the eye\'s adaptation once the night is dark (eased in from -12 to -18 deg sun): stops over the schedule\'s +15.5'],
    ['desat', 'night colour', 0, 1, 0.01, v => Math.round(v * 100) + ' % grey', 'how far the rods take the colour away where the light is under the cones\' threshold (the Purkinje shift)'],
    ['blue', 'moonlight blue', 0, 1, 0.01, v => Math.round(v * 100) + ' %', 'the blue-grey the rods\' grey is tinted toward'],
    ['colourCd', 'colour vision', 0.3, 30, 0.1, v => 'from ' + v.toFixed(1) + ' cd/m²', 'the luminance over which colour is whole; the rods alone a thousandth of it (CIE mesopic 0.005-5)'],
  ];
  // reset(row, v, fmt, put): the double-click on the row's name
  function resetOn(r, def, fmt, put) {
    if (!r || !r.firstChild) return;
    const k = r.firstChild;
    k.title = (k.title || k.textContent) + ' - double-click: back to ' + fmt(def);
    k.style.cursor = 'pointer';
    k.ondblclick = () => { put(def); const i = r.querySelector('input'); if (i) i.value = def; const b = r.querySelector('.v, output'); if (b) b.textContent = fmt(def); };
  }
  // mount(body, H): H the host's helpers ({ row, range, note } - the flight rail's flRow / flRange / flNote)
  function mount(body, H) {
    const L = LR();
    if (!L || !H || !H.range) return false;
    const r0 = H.row(body, 'the moonlight'); if (r0 && r0.classList) r0.classList.add('fsec');
    const D = L.nightDefaults();
    for (const [k, label, lo, hi, step, fmt, why] of DIALS) {
      const put = v => { const o = {}; o[k] = v; L.setNight(o); save(); kick(); };
      const r = H.range(body, label, lo, hi, step, () => L.night()[k], put, fmt);
      if (r && r.firstChild) r.firstChild.title = label + ': ' + why;
      resetOn(r, D[k], fmt, put);
    }
    if (isFinite(stars())) {
      const fmt = v => v.toFixed(1) + 'x', put = v => { setStars(v); save(); };
      const r = H.range(body, 'stars', 0, 3, 0.1, () => stars(), put, fmt);
      if (r && r.firstChild) r.firstChild.title = 'stars: the star field\'s brightness (the sky\'s own light hides them as it does)';
      resetOn(r, STARS_DEF, fmt, put);
    }
    // the night as it stands, in words: the moon's phase, its height, its light
    const d = (() => { try { return W.DAY_CLOCK && W.DAY_CLOCK.day && W.DAY_CLOCK.day(); } catch (e) { return null; } })();
    if (d && H.note) {
      const lux = L.moonE(d.moonPhase) * L.SUN_LUX;
      H.note(body, 'The moon: ' + Math.round(d.moonPhase * 100) + ' % lit, ' + (d.moonEl >= 0 ? d.moonEl.toFixed(0) + '° up' : 'below the horizon') +
        ' - ' + (d.moonEl >= 0 ? lux.toFixed(lux < 0.01 ? 4 : 2) + ' lux on a level field over the air (a full moon is 0.25).' : 'the night is the stars\'.') +
        ' Overcast or a new moon stays dark: the lights are what you see. Double-click a dial\'s name to put it back.');
    }
    return true;
  }
  load();
  const API = { mount, load, save, DIALS, KEY };
  if (W) W.MOON_UI = API;
  return API;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MOON_UI;
