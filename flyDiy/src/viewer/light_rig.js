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
    renderer.toneMappingExposure = ex;
    renderer.physicallyCorrectLights = PHYS;
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

  var API = {
    PHYS: PHYS,
    applyRig: applyRig,
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
