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
//   fly     'testfield' (G3790-G3794, PHONE-TESTFLIGHT; the user, 27 Oct: "On the phone, I think I'd still like a test
//                     flight ... 1 building, 1 runway, and some infinite thing. Only ability is to do a circuit"): the
//                     garage page still has no world (Roll out / Fly / the route pickers are not offered); the bench's
//                     Test flight row and the menu's line hand off to THE FLIGHT VARIANT below. 'none' = no test flight
//                     (the row and the line go, the welcome says "Build on this phone"): THE ONE SWITCH
//   ui      'touch'   html.phone: phone.css re-lays the workshop (the view over a sheet in portrait, beside it in
//                     landscape, a tab bar in the thumb zone) and phone.js gives the sliders a finger knob (R4-R13)
//   preset  'laptop'  the lightest picture (POTATO-DEEP's rung under potato), unless ?gfx= says otherwise
//   rail    the view rail's entries kept (the rest are a desktop's: controls, sound, the legend, the sky). G3725: the rail
//           is off the screen on every version now (its items are MENU pages); kept for the rigs
//   room    'studio' (G3726, PHONE-GARAGE; the user, 25 Oct: "no garage at all, just dark studio as we had said" - the M2
//           ruling of 4 Oct): the shed is never built; the aeroplane stands in a pool of light on black (studio.js)
//   benchOff the bench's tests that are not offered (bench.js usable): the test flight, the crosswind and the hydro test
//            need the world; the live sandbag rig runs seconds of a worker - its heat on a phone is measured first (v2).
//            The bench check (the shakedown) and the density altitude stay: pure computations, no world. (The test
//            flight's row follows `fly`: bench.js drops it while fly is 'none'.)
//
// THE FLIGHT VARIANT (G3791): a phone page booted with the test-flight intent (P.flyStart: sessionStorage
// 'flydiy.phone.fly', or ?testflight=1 for the rigs) is the same profile with FLIGHT's rows over its own - boot
// 'testfield': the world's boot rows run on the test field (build.js: FLYDIY_WORLD 'testfield', 20_world.js opts.flat -
// a few KB of world, never the island), the sim worker flies it, app.js rolls the aeroplane out on the pilot's circuit
// at the boot's end (no hand flying in v1). html.phfly marks the page (phone.css / phone.js stand the garage's layout
// down on it). The intent is taken at its read: a reload in flight (or Chrome killed under it) comes back to the
// garage, never into a loop. P.flyEnd (the way back to the shed) reloads the garage page.
//
// How a page becomes a phone: ?profile=phone (any device - the rigs, the S20's adb run, a desktop to look at it);
// welcome.js's device gate on a phone or tablet ("Build on this phone", remembered); ?profile=desktop forces the trunk.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const TABLE = {
    desktop: { boot: 'full', fly: 'roll', ui: 'desk', preset: null, rail: null, benchOff: null, room: 'shed' },
    phone: { boot: 'garage', fly: 'testfield', ui: 'touch', preset: 'laptop', rail: ['camera', 'display', 'explode', 'graphics'],
             benchOff: ['xwind', 'load', 'hydro'], room: 'studio' },
  };
  // G3791: THE FLIGHT VARIANT's rows over the profile's own (a profile with none has no test flight)
  const FLIGHT = { phone: { boot: 'testfield' } };
  const FKEY = 'flydiy.phone.fly';
  const ss = () => { try { return W.sessionStorage || null; } catch (e) { return null; } };
  // the intent, taken once (read and removed): { card } off the bench, or { url: true } off ?testflight=1
  let intent;
  const takeIntent = () => {
    if (intent !== undefined) return intent;
    intent = null;
    try { const S = ss(), t = S && S.getItem(FKEY); if (t) { S.removeItem(FKEY); intent = JSON.parse(t) || null; } } catch (e) { intent = null; }
    try { if (!intent && /[?&]testflight=1(&|$)/.test((W.location && W.location.search) || '')) intent = { url: true }; } catch (e) {}
    return intent;
  };
  const P = W.PROFILE = {
    TABLE, FLIGHT, name: 'desktop', why: 'the trunk', flight: null,
    get: k => { const f = P.flight && FLIGHT[P.name]; return f && k in f ? f[k] : TABLE[P.name][k]; },
    is: (k, v) => P.get(k) === v,
    // G3791: the garage's hand-off - the intent stored for the next load, the page reloaded on the test field (false when
    // the profile has no test flight). card: the bench's test card ({ alt, V }, the units app.js takes) or null
    flyStart: card => {
      if (P.flight || !FLIGHT[P.name] || P.is('fly', 'none')) return false;
      const S = ss(); if (!S) return false;
      try { S.setItem(FKEY, JSON.stringify({ card: card || null, at: Date.now() })); } catch (e) { return false; }
      try { W.location.reload(); } catch (e) { return false; }
      return true;
    },
    // ...and the way back: the garage page again (?testflight=1 dropped, so the rigs' door does not fly it twice)
    flyEnd: () => {
      try { const S = ss(); if (S) S.removeItem(FKEY); } catch (e) {}
      try {
        const L = W.location, q = (L.search || '').replace(/([?&])testflight=1(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
        if (q !== (L.search || '')) L.replace(L.pathname + q + (L.hash || '')); else L.reload();
      } catch (e) {}
    },
    // the switch, once, before the boot (welcome.js's gate resolves before the island loader and every script's promote)
    set: (name, why) => {
      if (!TABLE[name]) return false;
      P.name = name; P.why = why || name;
      const de = W.document && W.document.documentElement;
      if (de && de.classList) de.classList.toggle('phone', name === 'phone');
      // G3791: the flight variant - only where the profile has one and its switch is on
      P.flight = FLIGHT[name] && !P.is('fly', 'none') ? takeIntent() : null;
      if (de && de.classList) de.classList.toggle('phfly', !!P.flight);
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
