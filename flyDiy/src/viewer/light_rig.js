// light_rig.js — THE ONE PLACE THAT DECIDES WHAT LIGHT IS.
//
// WHY THIS FILE EXISTS (user, 2026-08-30: "the plane is lit from the bottom …
// we need to be able to add lights one by one from nothingness (all look
// black) … and the planes look really washed out when they get out of the
// garage and into the world").
//
// Before this file there were THREE independent light rigs — the hangar, the
// studio and the world — and each decided its own units, its own exposure and
// its own ambient. Two of them had no switches at all. The shed had been
// cleaned up twice (G62.5, G65) and neither clean-up ever reached the other
// two, so the aeroplane was lit one way indoors and another way out, and the
// difference read as "washed out" the moment it left the door.
//
// THE RULE THIS FILE ENFORCES, and the reason it is a file and not a comment:
// a room APPLIES a rig, it does not decide one. That is the same discipline
// tools/sky_prep.py already has over the hangar's moods, and it is the only
// thing that keeps two rooms in the same world agreeing about what a candela
// is.
//
// It owns four things:
//   1. THE RENDERER CONTRACT — exposure and the light model. Nothing else in
//      the project may set either.
//   2. THE GROUND BOUNCE — how much of a lit floor an environment probe is
//      allowed to hand back as light from below. This is the fix for the
//      symptom that named the file.
//   3. THE SWITCHBOARD — one per room, so "turn everything off and add them
//      back one at a time" is a thing every room can do, not just the shed.
//   4. THE CENSUS — the scene-graph audit that says whether the switchboard
//      is COMPLETE. Three times now a source has been found that no switch
//      could reach; each time it was a different KIND of source, and each
//      time the fix covered only the kind that had just been found.
(function () {
  'use strict';
  var T = (typeof THREE !== 'undefined') ? THREE : null;

  // ---- 1. THE RENDERER CONTRACT --------------------------------------------
  // ONE LIGHT MODEL EVERYWHERE. The room ran `physicallyCorrectLights = true`
  // and the world ran it false, so every light's intensity meant something
  // different on the two sides of the hangar door — and the exposure moved
  // 0.92 -> 1.12 in the same breath. The aeroplane's materials never changed;
  // the light arriving at them did, by two independent factors at once.
  //
  // TRUE is the side to unify on, because it is the side that is a model of
  // something: candela with inverse-square falloff. The legacy path is a
  // scale factor with no units, and there is nothing to calibrate it against.
  var PHYS = true;
  // W0.5a (r186): the physical model is the ONLY one three has now — the
  // renderer flag is gone — so the world's rows were converted at the light
  // (render_world.js LIGHT_UNIT) and this stays as the contract's statement.

  // ---- 2. THE GROUND BOUNCE ------------------------------------------------
  // AN ENVIRONMENT PROBE'S LOWER HEMISPHERE IS THE FLOOR, AND THE FLOOR IS NOT
  // A LIGHT. This is the whole diagnosis, and it took an ablation to see it:
  // at NIGHT, with the shed's other six sources muted one at a time, the
  // environment alone put 0 on the top of the wing and 7.4 on its underside —
  // i.e. the probe was not merely CONTRIBUTING to the belly glow, it WAS the
  // belly glow, and it lit nothing else.
  //
  // The mechanism is not a bug in anyone's arithmetic. G62.5 deleted three
  // OVERHEAD fill lights and restored the room's level by raising the
  // environment 0.55 -> 1.21 (x2.2), which was measured and is right for the
  // room as a whole. But the probe is a CubeCamera at (0, 3.2, 0) INSIDE the
  // shed, so half of what it captures is lit concrete — and that half got the
  // x2.2 as well. Directional fill was replaced with omnidirectional fill, and
  // half of "omnidirectional" points up.
  //
  // G62 had already ruled on exactly this for the hemisphere light it later
  // deleted: "the lower hemisphere integrates to about a third of the sky's
  // irradiance — right for something standing in that field, wrong for
  // something on a concrete floor inside a shed", anchored at x0.148. The
  // PROBE never got the equivalent term. This is that term.
  //
  // WHAT IT MODELS AND WHAT IT DOES NOT. A wing 1.9 m over a floor is not
  // looking at an unobstructed hemisphere of concrete: it shades the floor it
  // would be lit by, and the gap between the two is enclosed. That is
  // occlusion, and r128 gives us one scene.environment serving both the
  // diffuse irradiance and the specular reflection, with no way to attenuate
  // one without the other. So this is applied where it is honest and cheap —
  // the floor's own contribution to the bake — and the cost is that a mirror
  // would see a darker floor than the eye does. Nothing in this room is a
  // mirror; the floor is roughness 1.
  // OVERRULED BY THE USER, 2026-08-31: "set the ground bounce to 1". The
  // argument above is right about the physics and lost on the look, and it
  // stays in the file for exactly that reason — the next person to raise it
  // deserves to find the answer already here rather than re-derive it. 0.148
  // was the measured occlusion term; 1 is the unoccluded half-dome of lit
  // concrete, and it brightens every underside in the room. GATE LIGHT's own
  // check was written to forbid this value and was changed with it, on the
  // same call, rather than quietly relaxed.
  var GROUND_BOUNCE = 1;
  var GROUND_BOUNCE_0 = GROUND_BOUNCE;      // the resting value, for reset

  // ---- the day-cycle row ---------------------------------------------------
  // Both rooms read a row of the SAME table. The hangar's rows come measured
  // off their own HDRI by tools/sky_prep.py; the world's sky is a shader and
  // has no HDR to measure, so it names the row whose hour it is drawn for and
  // takes the rig from that. What has to match is not the picture — it is the
  // units, the exposure and the environment level.
  var WORLD_ROW = 'gdusk';        // the world is drawn as a low, warm sun

  function rowByKey(rows, key) {
    if (!rows || !rows.length) return null;
    for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i];
    return rows[0];
  }

  // APPLY, never decide. `ex` is the row's own authored exposure; a room that
  // has no row (the headless gate) gets the anchor's.
  function applyRig(renderer, row) {
    if (!renderer) return null;
    var ex = (row && typeof row.ex === 'number') ? row.ex : 0.92;
    if (typeof window !== 'undefined' && window.GFX && window.GFX.setExposure) window.GFX.setExposure(renderer, ex);
    else renderer.toneMappingExposure = ex;
    return ex;
  }

  // ---- 3. THE SWITCHBOARD --------------------------------------------------
  // One per room. A source DECLARES itself with the action that mutes it, so
  // the list and the muting can never disagree — the shed's old hand-kept list
  // is exactly what let the stove burn on unswitchable through two chantiers.
  //
  // A MUTE IS APPLIED AFTER THE ROOM HAS SET ITS INTENSITIES (G62.3), so
  // changing the sky cannot quietly switch a source back on underneath a
  // running test. That ordering is the caller's job: set your levels, then
  // call apply().
  //
  // KIND is not decoration. The census below can only be complete if it knows
  // which kinds exist, and every one of the three was discovered the hard way:
  //   'light'    — a THREE.Light                       (G62.7, the stove)
  //   'emissive' — a material that emits               (G65, the desk lamp)
  //   'unlit'    — a MeshBasicMaterial, which is lit by nothing and therefore
  //                cannot be dimmed by anything        (this chantier)
  //   'env'      — scene.environment, which is not an object at all
  function board(roomName) {
    var list = [], muted = {}, acts = {};
    var B = {
      room: roomName,
      declare: function (key, name, kind, mute) {
        if (!acts[key]) { list.push({ key: key, name: name, kind: kind }); acts[key] = []; }
        if (mute) acts[key].push(mute);
        return B;
      },
      list: function () { return list.map(function (l) { return { key: l.key, name: l.name, kind: l.kind }; }); },
      kinds: function () { var k = {}; list.forEach(function (l) { k[l.key] = l.kind; }); return k; },
      on: function (k) { return !muted[k]; },
      has: function (k) { return !!acts[k]; },
      set: function (k, v) { if (!acts[k]) return null; muted[k] = !v; return !muted[k]; },
      // THE THING THE USER ASKED FOR: start from nothing and add one back.
      allOff: function () { list.forEach(function (l) { muted[l.key] = true; }); return B; },
      allOn: function () { list.forEach(function (l) { muted[l.key] = false; }); return B; },
      only: function (k) { list.forEach(function (l) { muted[l.key] = (l.key !== k); }); return B; },
      muted: function () { var m = {}; list.forEach(function (l) { m[l.key] = !!muted[l.key]; }); return m; },
      apply: function () {
        list.forEach(function (l) {
          if (!muted[l.key]) return;
          acts[l.key].forEach(function (f) { try { f(); } catch (e) {} });
        });
        return B;
      }
    };
    return B;
  }

  // ---- 4. THE CENSUS -------------------------------------------------------
  // WHAT IS ACTUALLY EMITTING IN THIS SCENE, asked of the scene graph rather
  // than of a list somebody maintained. The list is what has been wrong every
  // previous time.
  //
  // `claimed` is a Set of the materials and objects the room says it can
  // reach. Anything emitting that is not in it is UNCLAIMED — a light with no
  // switch, which is the exact shape of every recurrence of this bug.
  //
  // The honest exception is named, not fudged: the sky seen THROUGH a cut
  // opening is the view out of the window, not a light in the shed (G65), and
  // a room may mark its backdrop `userData.lightExempt = 'the view outside'`.
  function census(scene, claimed) {
    var lights = [], emissive = [], unlit = [], unclaimed = [];
    var seen = claimed || { has: function () { return false; } };
    if (!scene || !scene.traverse) return { lights: [], emissive: [], unlit: [], unclaimed: [] };
    var shown = function (o) { var p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
    scene.traverse(function (o) {
      if (o.isLight) {
        var rec = { kind: 'light', type: o.type, y: +(o.position.y).toFixed(2), i: o.intensity };
        lights.push(rec);
        if (!seen.has(o)) unclaimed.push(rec);
        return;
      }
      if (!o.isMesh || !o.material) return;
      var mats = [].concat(o.material);
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (!m) continue;
        if (m.userData && m.userData.lightExempt) continue;
        if (m.emissive && m.emissiveIntensity > 0 &&
            (m.emissive.r || m.emissive.g || m.emissive.b)) {
          var e = { kind: 'emissive', name: m.name || m.type, i: m.emissiveIntensity };
          emissive.push(e);
          if (!seen.has(m)) unclaimed.push(e);
        }
        // A MeshBasicMaterial IGNORES EVERY LIGHT IN THE SCENE, which means it
        // is at full brightness in a room with nothing switched on. It is not
        // a light in the physical sense and it does not illuminate anything —
        // but it is the only thing left on the screen when the answer is
        // supposed to be black, so a "start from nothing" claim is false
        // until each one is either switchable or explicitly exempt.
        else if (m.isMeshBasicMaterial && shown(o)) {
          var u = { kind: 'unlit', name: m.name || m.type };
          unlit.push(u);
          if (!seen.has(m)) unclaimed.push(u);
        }
      }
    });
    return { lights: lights, emissive: emissive, unlit: unlit, unclaimed: unclaimed };
  }

  // ---- 4. THE DAY'S EXPOSURE (SKY S3, 2026-09-14) --------------------------
  // The physical sky spans twenty stops between noon and a moonlit night and
  // a tone curve holds six, so the exposure is a SCHEDULE on the sun's
  // elevation - the eye's adaptation, authored. It is one curve for both
  // rooms (the rule this file exists for), expressed in STOPS over the
  // alps-afternoon base the user judged (0.92 at 33 deg):
  //     33 deg and up   0 stops (the base)
  //     10.6 deg      +1.0 (the sunset row's 1.12 x its dimmer key: the
  //                        calibration in sky_light.js fits the product)
  //     sunset         +2.5     civil dusk (-6)  +6     nautical (-12)  +13
  //     astro (-18)     +15     night         +15.5  (a full moon at 2.5e-6
  //                        of the sun reads at ~7 % of noon: a game night;
  //                        June's -11.5 deg at 55 N is a dim but readable dusk)
  // Piecewise-linear in elevation, monotone, no discontinuity: the stops
  // move ~0.4 a degree through the twilight, which at 1x is a stop every
  // 5 minutes - imperceptible frame to frame.
  var EV_BASE = 0.92;
  var EV_KNOTS = [[-90, 15.5], [-18, 15], [-12, 13], [-9, 10], [-6, 6], [-0.833, 2.5], [10.6, 0.6], [33, 0], [90, 0]];
  function exposureStops(el) {
    var k = EV_KNOTS;
    // G2600: the NIGHT EYE dial - stops over the schedule once the night is dark (eased in from nautical to
    // astronomical twilight, 0 above -12 deg: the day and the twilight are the schedule's to the bit)
    var e = NIGHT.eye ? NIGHT.eye * smooth01((-12 - el) / 6) : 0;
    if (el <= k[0][0]) return k[0][1] + e;
    for (var i = 1; i < k.length; i++) if (el <= k[i][0]) {
      var t = (el - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return k[i - 1][1] + t * (k[i][1] - k[i - 1][1]) + e;
    }
    return k[k.length - 1][1];
  }
  function exposureFor(el, k) { return EV_BASE * Math.pow(2, exposureStops(el)) * (k == null ? 1 : k); }
  // the illuminance ratios the sky's two lights stand in (sun = 1)
  var MOON_RATIO = 2.5e-6;        // a full moon: 0.25 lux against 1e5
  var SUN_LUX = 1e5;              // ... and the 1e5 lux the sun stands for: the scale that names a radiance in cd/m2

  // ---- 5. THE NIGHT (G2600 MOONLIGHT, 2026-10-08) ----------------------------
  // The user: "can we have some full moon nights, where it's possible to see something, so VFR at night,
  // even though super dangerous, becomes somehow possible?" The schedule above was always meant to read a
  // full moon as a game night; what follows is the rest of what the eye does in it, kept physical:
  //   THE PHASE LAW. A moon's light is not its lit fraction: the half moon gives ~9 % of the full, not 50 %
  //     (the regolith's back-scatter; Allen 1973 as Krisciunas & Schaefer 1991 use it,
  //     m(alpha) = -12.73 + 0.026|alpha| + 4e-9 alpha^4, alpha the phase angle). moonE(phase) is what the
  //     key, the sky, the clouds and the mist all take - one law, read everywhere the moon lights.
  //   THE NIGHT EYE (scotopic vision, the Purkinje shift). Under ~3 cd/m2 the cones give way to the rods,
  //     which see no colour and peak in the blue-green (507 nm): a moonlit field is grey-blue, red goes dark
  //     first, a lamp stays coloured because IT is bright. The grade is per pixel ON ITS ABSOLUTE LUMINANCE
  //     (the radiance in the frame x SUN_LUX / the room's scale), before the one tone map (aa_resolve's
  //     blit, under the linear compositing - a uniform branch, no pass): the rods' share runs from 0 at
  //     `colourCd` to 1 a thousandth of it (CIE's mesopic range is 0.005-5 cd/m2), times `desat`. The rods'
  //     response in linear sRGB is the Larson-Rushmeier-Piatko (1997) scotopic luminance evaluated at the
  //     three primaries (0.033 0.765 0.202 - red a sixth of its photopic weight, blue three times), and the
  //     grey it gives is tinted toward the blue-grey moonlight reads as (`blue`). By day the share is 0
  //     (the sun above -0.833 deg) and the blit skips the branch: the day is the day to the bit.
  // Every number here is a dial (moon_ui.js mounts them on the left rail's NIGHT, double-click resets);
  // NIGHT_DEF holds the resting values.
  // the resting values, judged on the 8 Oct stills (reports/evidence/MOONLIGHT/sheet_full_moon.jpg: before | eye 0 | +1 | +2):
  // +1 stop reads a full moon as a dangerous but flyable night (the coast, the lakes, the strips, the ridges), +2 is a dusk
  var NIGHT_DEF = { eye: 1, moon: 1, desat: 0.9, blue: 0.6, colourCd: 3 };
  var NIGHT = {}; for (var nk in NIGHT_DEF) NIGHT[nk] = NIGHT_DEF[nk];
  function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  // the phase law: a phase's light over the full moon's (phase = the illuminated fraction, 06_solar)
  function moonPhaseLaw(phase) {
    var k = Math.max(0, Math.min(1, phase == null ? 0 : phase));
    var a = Math.acos(Math.max(-1, Math.min(1, 2 * k - 1))) * 180 / Math.PI;   // the phase angle, deg (0 full, 180 new)
    return Math.pow(10, -0.4 * (0.026 * a + 4e-9 * a * a * a * a));
  }
  function moonE(phase) { return MOON_RATIO * NIGHT.moon * moonPhaseLaw(phase); }
  // the grade's uniforms: ONE set, shared by reference with every blit material aa_resolve builds
  var V4 = function (a, b, c, d) { return (T && T.Vector4) ? new T.Vector4(a, b, c, d) : [a, b, c, d]; };
  var nightU = { uNightEye: { value: V4(0, 0, 0, 0) }, uNightTint: { value: V4(1, 1, 1, 0) } };
  var NIGHT_GLSL = [
    'uniform vec4 uNightEye;    // x the night\'s share (0 by day), y log2(cd/m2 per unit), z/w log2 cd/m2: rods alone / colour whole',
    'uniform vec4 uNightTint;   // rgb the rods\' tint (luma 1), a their share at full rod vision',
    'vec3 nightEye(vec3 c) {',
    '  if (uNightEye.x <= 0.0) return c;',
    '  float Lp = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float Ls = dot(c, vec3(0.033, 0.765, 0.202));',
    '  float rod = (1.0 - smoothstep(uNightEye.z, uNightEye.w, log2(max(Lp, 1e-30)) + uNightEye.y)) * uNightEye.x * uNightTint.a;',
    '  return mix(c, Ls * uNightTint.rgb, rod);',
    '}'].join('\n');
  var BLUE_TINT = [0.86, 1.0, 1.37];   // moonlight's blue-grey, luma ~1
  // nightGrade(el, scale): the grade's uniforms for a sun elevation and the room's radiance scale (ATMO.U.scale)
  function nightGrade(el, scale) {
    var s = smooth01((-0.833 - el) / 5.167);   // 0 at sunset, 1 at civil dusk
    var u = nightU.uNightEye.value, t = nightU.uNightTint.value;
    var y = Math.log(SUN_LUX / Math.max(1e-9, scale || 1)) / Math.LN2;
    var hi = Math.log(Math.max(1e-4, NIGHT.colourCd)) / Math.LN2, lo = hi - Math.log(1000) / Math.LN2;
    var b = Math.max(0, Math.min(1, NIGHT.blue));
    var r = 1 + (BLUE_TINT[0] - 1) * b, g = 1 + (BLUE_TINT[1] - 1) * b, bl = 1 + (BLUE_TINT[2] - 1) * b;
    var l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    var a = s > 0 ? Math.max(0, Math.min(1, NIGHT.desat)) : 0;
    if (u.set) { u.set(s, y, lo, hi); t.set(r / l, g / l, bl / l, a); }
    else { u[0] = s; u[1] = y; u[2] = lo; u[3] = hi; t[0] = r / l; t[1] = g / l; t[2] = bl / l; t[3] = a; }
    return s;
  }
  // the dials: set / reset / the defaults (published, so a reset reads the one table)
  // ---- 6. THE PRE-EXPOSURE (G2620 PRE-EXPOSURE, 2026-10-08) -----------------
  // The frame's target is HalfFloat and holds UN-EXPOSED radiance (G448.3's linear compositing: the exposure is the
  // blit's). A moonlit night is ~1e-7 of the day's scale - fp16 SUBNORMALS stepped in 5.96e-8: G2600 measured the
  // full-moon ground at 6-11 distinct values and the final's ground band at ONE (reports/evidence/MOONLIGHT). So at
  // night every radiance written into the WORLD's frame is multiplied by P and the renderer's exposure divided by P
  // (Frostbite's pre-exposure): the picture is the same, the precision is fp16's normal range.
  //   P is ONE SWITCH: 2^14 once the sun is under -6.5 deg, 1 again above -5.5 (the hysteresis). Every writer, the
  //   eased lights, the exposure, the probes and the mirror move in the same frame (setPre's listeners), so a switch
  //   per whole stop would have been ten chances a dusk to flash a frame. The range: at -6 deg the brightest radiance
  //   in the frame (the twilight sky ~800, the moon's disc ~6e3, a lamp) stays under fp16's 65 504; the full-moon
  //   ground lands at ~6.5e-3, ten bits of mantissa.
  //   By day P = 1 and every writer multiplies by 1: the day is bit-identical by construction. The GARAGE keeps P = 1
  //   (its lamps cap the exposure: no precision problem) - its applyDay sets it on entry, the world's on the way out.
  //   GFX keeps the TRUE exposure as its base (every nightK dimmer reads it unchanged) and puts base / P on the renderer.
  // A WRITER OF ABSOLUTE LIGHT IN THE WORLD (a lamp, an emissive, an unlit colour) multiplies by P() where it writes
  // (per frame), or registers its constant with preHold(obj, key, base) (written base x P at every switch). GATE LIGHT
  // sweeps the sources for writers that do neither and do not name why they are exempt.
  var PRE_NIGHT = 16384, PRE_IN = -6.5, PRE_OUT = -5.5;
  var PRE = { P: 1, switches: 0 }, preFns = [], preHeld = [];
  // preFor(el): the P a sun elevation asks for, from the P in force (the hysteresis)
  function preFor(el) { return PRE.P > 1 ? (el > PRE_OUT ? 1 : PRE.P) : (el < PRE_IN ? PRE_NIGHT : 1); }
  // setPre(P): the switch - the held constants written, then every listener told (old, new), in this frame
  function setPre(P) {
    P = (typeof P === 'number' && P > 0 && isFinite(P)) ? P : 1;
    if (P === PRE.P) return false;
    var old = PRE.P; PRE.P = P; PRE.switches++;
    var live = [];
    for (var i = 0; i < preHeld.length; i++) { var h = preHeld[i]; try { if (writeHeld(h)) live.push(h); } catch (e) {} }
    preHeld = live;   // the held objects that are gone (a material disposed with its aeroplane) leave the list
    for (var j = 0; j < preFns.length; j++) { try { preFns[j](P, old); } catch (e) {} }
    return true;
  }
  // held WEAKLY (a WeakRef where there is one): a held material does not outlive the aeroplane or the world it belongs to
  var hold = function (o) { return (typeof WeakRef === 'function') ? { r: new WeakRef(o) } : { o: o }; };
  var heldObj = function (h) { return h.ref.r ? h.ref.r.deref() : h.ref.o; };
  function writeHeld(h) {
    var o = heldObj(h); if (!o) return false;
    if (h.color) { o.setRGB(h.base[0] * PRE.P, h.base[1] * PRE.P, h.base[2] * PRE.P); return true; }
    o[h.key] = h.base * PRE.P;
    return true;
  }
  // preHold(obj, key, base): a constant held at base x P (obj[key] = base * P now and at every switch); returns base.
  // preHold(color, 'rgb') holds a THREE.Color at its current rgb x P.
  function preHold(obj, key, base) {
    if (!obj) return base;
    for (var i = 0; i < preHeld.length; i++) if (heldObj(preHeld[i]) === obj && preHeld[i].key === key) { if (key !== 'rgb') preHeld[i].base = base; writeHeld(preHeld[i]); return base; }
    var h = key === 'rgb' ? { ref: hold(obj), key: key, color: true, base: [obj.r, obj.g, obj.b] } : { ref: hold(obj), key: key, base: base };
    preHeld.push(h); writeHeld(h); return base;
  }
  function onPre(fn) { if (typeof fn === 'function') preFns.push(fn); return fn; }
  function setNight(o) {
    if (o) for (var k in o) if (k in NIGHT_DEF && typeof o[k] === 'number' && isFinite(o[k])) NIGHT[k] = o[k];
    return night();
  }
  function night() { var o = {}; for (var k in NIGHT) o[k] = NIGHT[k]; return o; }

  var API = {
    PHYS: PHYS,
    applyRig: applyRig,
    exposureFor: exposureFor, exposureStops: exposureStops, EV_BASE: EV_BASE, MOON_RATIO: MOON_RATIO,
    // G2600 THE NIGHT: the phase law, the night eye's grade, the dials
    SUN_LUX: SUN_LUX, moonPhaseLaw: moonPhaseLaw, moonE: moonE, nightU: nightU, NIGHT_GLSL: NIGHT_GLSL, nightGrade: nightGrade,
    // G2620 THE PRE-EXPOSURE
    P: function () { return PRE.P; }, PRE_NIGHT: PRE_NIGHT, preFor: preFor, setPre: setPre, preHold: preHold, onPre: onPre,
    preState: function () { return { P: PRE.P, switches: PRE.switches, held: preHeld.length, listeners: preFns.length }; },
    setNight: setNight, night: night, nightDefaults: function () { var o = {}; for (var k in NIGHT_DEF) o[k] = NIGHT_DEF[k]; return o; },
    board: board,
    census: census,
    rowByKey: rowByKey,
    WORLD_ROW: WORLD_ROW,
    groundBounce: function () { return GROUND_BOUNCE; },
    // THE DEFAULT IS PUBLISHED, not copied into the panel. The editor's
    // ground-bounce row is hand-built (it is not a _cage_ui row and has no
    // DEFAULTS table behind it), so "double-click to reset" needs somewhere
    // to read the resting value from — and a number restated in the UI is a
    // number that goes stale the first time this one moves.
    groundBounceDefault: function () { return GROUND_BOUNCE_0; },
    setGroundBounce: function (v) {
      if (typeof v === 'number' && isFinite(v))
        GROUND_BOUNCE = Math.max(0, Math.min(1, v));
      return GROUND_BOUNCE;
    }
  };

  if (typeof window !== 'undefined') window.LIGHT_RIG = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
