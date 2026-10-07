// profile.js - THE PROFILES: THE PHONE IS A PROFILE OF THE DESKTOP TRUNK (MOBILE-GARAGE 1, G2100-G2104)
//
// futureDesigns/MOBILE-GARAGE-2026-10-04.md §6 (the user's ruling, 4 Oct: "the mobile experience has to derive entirely
// from the desktop trunk, automatically at each release"). ONE page, ONE build: a profile is a set of switches over the
// trunk, and A PROFILE MAY ONLY SUBTRACT - it removes, defers or re-lays-out something the desktop has; it never adds a
// feature the desktop lacks. Code asks the profile (PROFILE.is('boot', 'garage')), never the device: the device is
// read in ONE place, welcome.js, which picks the profile the way it picks the preset.
//
// 'desktop' is the default and is EVERYTHING AS IT WAS: no class on <html>, every switch at the trunk's value, so a
// desktop's page, pixels and gates are the ones they were (UISMOKE / INSTANT / BUILD / ROUNDTRIP identical).
//
// 'phone' (slice 1, 6 Oct 2026 - the garage on a touch screen; the world and the flight are NOT in it):
//   boot    'garage'  the boot's world rows off (the study's §1.2 table: tree bins, world, town, parking, trees, ring,
//                     settle, the parked cook, the flown bake, images, upload, the world's compile and frames, the
//                     craft's programs, the recheck's re-plan, the sim worker's prewarm) and the island never fetched
//                     (FLYDIY_WORLD 'none', the analytic world, as ?world=none)
//   fly     'none'    Roll out / Fly / the route pickers are not offered (no world to roll out into)
//   ui      'touch'   html.phone: phone.css re-lays the workshop (the view over a sheet in portrait, beside it in
//                     landscape, a tab bar in the thumb zone) and phone.js gives the sliders a finger knob (R4-R13)
//   preset  'laptop'  the lightest picture (POTATO-DEEP's rung under potato), unless ?gfx= says otherwise
//   rail    the view rail's entries kept (the rest are a desktop's: controls, sound, the legend, the sky)
//   benchOff the bench's tests that are not offered (bench.js usable): the test flight, the crosswind and the hydro test
//            need the world; the live sandbag rig runs seconds of a worker - its heat on a phone is measured first (v2).
//            The bench check (the shakedown) and the density altitude stay: pure computations, no world
//
// How a page becomes a phone: ?profile=phone (any device - the rigs, the S20's adb run, a desktop to look at it);
// welcome.js's device gate on a phone or tablet ("Build on this phone", remembered); ?profile=desktop forces the trunk.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const TABLE = {
    desktop: { boot: 'full', fly: 'roll', ui: 'desk', preset: null, rail: null, benchOff: null },
    phone: { boot: 'garage', fly: 'none', ui: 'touch', preset: 'laptop', rail: ['camera', 'display', 'explode', 'graphics'],
             benchOff: ['flight', 'xwind', 'load', 'hydro'] },
  };
  const P = W.PROFILE = {
    TABLE, name: 'desktop', why: 'the trunk',
    get: k => TABLE[P.name][k],
    is: (k, v) => TABLE[P.name][k] === v,
    // the switch, once, before the boot (welcome.js's gate resolves before the island loader and every script's promote)
    set: (name, why) => {
      if (!TABLE[name]) return false;
      P.name = name; P.why = why || name;
      const de = W.document && W.document.documentElement;
      if (de && de.classList) de.classList.toggle('phone', name === 'phone');
      // THE KNOB'S RELEASE GOES FIRST (phone.js R13): a finger's last move may still wait for its frame when it lifts,
      // and it must reach the slider as a drag tick BEFORE _cage_ui.js's own window pointerup (the release build) runs.
      // A capture listener on window runs in the order it was added, and this one is added before any deferred script
      // is promoted - so it is first. The phone's alone: the desktop never registers it
      if (name === 'phone' && !P.upHooked && W.addEventListener) {
        P.upHooked = true;
        const up = e => { if (typeof P.onUp === 'function') try { P.onUp(e); } catch (x) {} };
        W.addEventListener('pointerup', up, true);
        W.addEventListener('pointercancel', up, true);
      }
      return true;
    },
  };
  let q = '';
  try { q = (W.location && W.location.search) || ''; } catch (e) {}
  const m = /[?&]profile=(phone|desktop)(&|$)/.exec(q);
  if (m) P.set(m[1], '?profile=' + m[1]);
})();
