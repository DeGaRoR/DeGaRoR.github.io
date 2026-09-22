// animal_run.js — WHAT THE ANIMALS DO (2026-09-22).
//
// One HOTSPOT record — `{ key, x, z, n, r }`, an `objects` entry of the
// premises record — becomes a herd, a pod or a flock. This module owns the
// behaviour and nothing else: src/viewer/animals.js owns the mesh, the clips
// and the ladder, and is not told what a bear is.
//
// THE THREE BEHAVIOURS, and the one rule they share — the user's, 2026-09-22:
// "don't author anything for the 2 first ones, they're great and complete,
// just do animations chaining clips. Do what's necessary only for the whales
// and birds, take no risk." So no joint is written by hand anywhere below.
//
//   LAND (bear, elk, doe) — a CLIP MACHINE over the animal's own library:
//   idle / browse / walk / lie, with the asset's own transitions played
//   through where the pair exists and a quarter-second cross-fade where it
//   does not. A walking animal advances at the CLIP'S OWN measured ground
//   speed (tools/animal_prep.py took the root's travel out of the frames and
//   put it in `travel`), so the feet do not skate; its y is the ground under
//   it and its attitude the ground's normal, low-passed. A step into water,
//   up a slope over 28 deg, or out of the hotspot's radius is refused and the
//   animal turns instead. Mostly idle, as asked.
//
//   SEA (blue whale, orca) — the body keeps its one delivered loop, whose
//   rate follows the speed; everything else is the ROOT. A slow circuit about
//   the hotspot, and one dive cycle: up at the surface for a fifth of it (the
//   back and the dorsal out of the water), then an arch down to `depth` and a
//   cruise there. The DERIVATIVE of that depth is the pitch, so the arch is
//   the motion and not a keyframe. Submerged, it LOOMS (animals.js's second,
//   unlit draw over the water). At the surface it makes the aeroplane's own
//   water: a `press` stamp of its beam, `foam` along its back, a `ring` and a
//   burst of SPRAY when it breaks out — and it BLOWS, a plume on the village
//   chimney's own recipe (plume.js).
//
//   AIR (the gull) — flocks. The delivered file is already five birds in a V,
//   so the V is what this makes: one lead point on a track, the members on
//   fixed offsets, each on its own phase of the 0.67 s flap. A PLACED flock
//   circles its hotspot; the AMBIENT ones (`ambient()`, the world's, not a
//   premises') are born outside 1.2 km of the eye, cross, and die at 1.6.
//
// HOST CONTRACT — make(THREE, ctx):
//   ctx.scene      the Object3D to add to (world coordinates)
//   ctx.ground(x, z)   -> terrain height             (required)
//   ctx.waterH(x, z)   -> water level or -Infinity   (required for sea)
//   ctx.eye()      -> {x, y, z} the camera, for the cull and the ambient ring
//   ctx.stamp(x, z, r, amp, foam, kind)   the water field (WATER.stamp); optional
//   ctx.spray(kind, x, y, z, vx, vy, vz)  the spray sprites; optional
//   ctx.lit()      -> the day's haze factor for the plume (render_premises's)
//   ctx.wind()     -> [wx, wz] m/s, for the plume's lean
// Everything optional is ASKED, never assumed: the node gate hands it a flat
// ground and no water at all, and the same code runs.
'use strict';
(function () {
const AR = {};
const TWO_PI = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// the codec's own helpers and the factory, ASKED rather than assumed: in the
// bundle they are globals, in the node gate they are what the harness put on
// `window` (tools/_animal_check.js) — and a page without the animals layer at
// all gets a runner that does nothing rather than a crash.
const ANI = () => (typeof window !== 'undefined' && window.ANIMALS) || null;
const CLIPS = (a, role) => (typeof animalClips === 'function' ? animalClips(a, role) : []);
const CLIP = (a, role, pick) => (typeof animalClip === 'function' ? animalClip(a, role, pick) : null);
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// how far an animal of each kind is kept alive at all (beyond this the handle
// stays but nothing is stepped and nothing is drawn)
const REACH = { land: 1400, sea: 3200, air: 2200 };
// at most this many of the interaction field's 16 stamps a frame go to
// animals, nearest first — the aeroplane's own hull comes first (app.js)
const STAMP_BUDGET = 4;

AR.make = function (THREE, ctx) {
  const scene = ctx.scene;
  const ground = ctx.ground || (() => 0);
  const waterH = ctx.waterH || (() => -Infinity);
  // NO EYE, NO CULL (asked, never assumed): a host that does not hand one - the premises bench -
  // gets every animal stepped rather than every animal culled against the origin
  const eye = ctx.eye || null;
  const root = new THREE.Group();
  root.name = 'animals';
  if (scene) scene.add(root);

  const HERDS = new Map();          // spot id -> { key, spec, ones: [...] }
  const FLOCKS = [];                // the ambient ones (no record)
  const stats = { herds: 0, animals: 0, shown: 0, stamps: 0, blows: 0 };
  let T = 0;

  // ---- the frames ---------------------------------------------------------
  const _F = new THREE.Vector3(), _U = new THREE.Vector3(), _R = new THREE.Vector3();
  const _M = new THREE.Matrix4(), _Mb = new THREE.Matrix4(), _Q = new THREE.Quaternion();
  const _V = new THREE.Vector3();
  // the model's own basis, from the manifest's `forward` — built once a key
  const BASIS = new Map();
  function basisOf(a) {
    let b = BASIS.get(a.key);
    if (!b) {
      const f = a.forward || [0, 1];
      const F = new THREE.Vector3(f[0], 0, f[1]).normalize();
      const U = new THREE.Vector3(0, 1, 0);
      const R = new THREE.Vector3().crossVectors(U, F);
      b = new THREE.Matrix4().makeBasis(R, U, F).transpose();    // orthonormal: the inverse
      BASIS.set(a.key, b);
    }
    return b;
  }
  // point the animal's forward along F with its up along U — ONE function for
  // all three behaviours, because "which way is the model's nose" is a fact
  // the manifest carries and never a per-behaviour assumption
  function orient(one, F, U, lerp) {
    _F.copy(F).normalize();
    _U.copy(U);
    _U.addScaledVector(_F, -_U.dot(_F));
    if (_U.lengthSq() < 1e-8) _U.set(0, 1, 0);
    _U.normalize();
    _R.crossVectors(_U, _F);
    _M.makeBasis(_R, _U, _F).multiply(basisOf(one.a));
    _Q.setFromRotationMatrix(_M);
    if (lerp > 0 && lerp < 1) one.H.obj.quaternion.slerp(_Q, lerp);
    else one.H.obj.quaternion.copy(_Q);
  }
  // the ground's normal, by difference (the props' own tiltToGround law)
  function normalAt(x, z, d, out) {
    const gx = (ground(x + d, z) - ground(x - d, z)) / (2 * d);
    const gz = (ground(x, z + d) - ground(x, z - d)) / (2 * d);
    return out.set(-gx, 1, -gz).normalize();
  }

  // ---- one individual -----------------------------------------------------
  function makeOne(spot, i) {
    const AN = ANI();
    const a = AN ? AN.reg(spot.key) : null;
    if (!a) return null;
    const rnd = mulberry32(fnv(String(spot.id) + ':' + i));
    const H = AN.place(THREE, spot.key, {});
    if (!H) return null;
    root.add(H.obj);
    const one = { spot, i, a, H, rnd, kind: a.kind,
                  x: 0, z: 0, y: 0, hd: rnd() * TWO_PI,
                  state: 'idle', t: 0, dwell: 1 + rnd() * 3, next: null,
                  tgt: null, depth: 0, phase: rnd(), wasUp: false, plume: null,
                  up: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(0, 0, 1) };
    // where it starts: scattered in the hotspot, seeded per individual so
    // adding one never moves the others (the premises contract's rule 5)
    let ang = rnd() * TWO_PI, rr = spot.r * Math.sqrt(rnd());
    one.x = spot.x + Math.cos(ang) * rr;
    one.z = spot.z + Math.sin(ang) * rr;
    // A LAND ANIMAL IS NOT SOWN IN THE SEA. Eight tries inside the hotspot,
    // then the centre: a hotspot the author put half in the water still makes
    // a herd, on the half that is land.
    if (a.kind === 'land') for (let k = 0; k < 8 && ground(one.x, one.z) <= waterH(one.x, one.z) + 0.2; k++) {
      ang = rnd() * TWO_PI; rr = spot.r * Math.sqrt(rnd());
      one.x = spot.x + Math.cos(ang) * rr; one.z = spot.z + Math.sin(ang) * rr;
    }
    one.a0 = ang;                                   // the sea circuit's own angle
    one.rJit = 0.75 + 0.5 * rnd();
    one.dir.set(Math.sin(one.hd), 0, Math.cos(one.hd));
    // NO TWO THE SAME SIZE (the table's `spread`): a herd of identical animals is a tell, and a
    // POD is not even meant to be uniform - an orca pod is a bull, a matriarch and calves. One
    // scale on the whole LOD, so every level of the ladder wears it and nothing else notices.
    const sp = +a.spread || 0;
    one.size = sp > 0 ? 1 + (rnd() * 2 - 1) * sp : 1;
    if (one.size !== 1) H.obj.scale.setScalar(one.size);
    H.obj.position.set(one.x, ground(one.x, one.z), one.z);
    return one;
  }

  // ---- LAND: the clip machine --------------------------------------------
  const LAND_STATES = ['idle', 'browse', 'walk', 'lie'];
  function landPick(one) {
    const m = one.a.mood || {};
    const w = [m.idle === undefined ? 0.4 : m.idle, m.browse === undefined ? 0.3 : m.browse,
               m.walk === undefined ? 0.25 : m.walk, m.lie === undefined ? 0.05 : m.lie];
    let s = w[0] + w[1] + w[2] + w[3], r = one.rnd() * s;
    for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return LAND_STATES[i]; }
    return 'idle';
  }
  function landEnter(one, state) {
    // the asset's own transition, where the pair has one: played through, and
    // the state entered when it ends (`next`)
    const via = (one.state === 'idle' && state === 'walk') ? 'toWalk'
      : (one.state === 'idle' && state === 'lie') ? 'toLie'
      : (one.state === 'lie' && state !== 'lie') ? 'fromLie' : null;
    if (via && CLIPS(one.a, via).length) {
      one.state = 'trans'; one.next = state; one.t = 0;
      const c = H_clip(one, via);
      one.H.play(c, { fade: 0.22, loop: false });
      one.dwell = c ? c.dur : 0.5;
      return;
    }
    landStart(one, state);
  }
  const H_clip = (one, role) => CLIP(one.a, role, one.rnd());
  function landStart(one, state) {
    one.state = state; one.t = 0; one.next = null;
    const c = H_clip(one, state === 'walk' ? 'walk' : state);
    if (c) one.H.play(c, { fade: 0.25, loop: true, rate: 1 });
    if (state === 'walk') {
      // somewhere else inside the hotspot, and never more than 60 m off
      const ang = one.rnd() * TWO_PI, rr = one.spot.r * Math.sqrt(one.rnd());
      one.tgt = { x: one.spot.x + Math.cos(ang) * rr, z: one.spot.z + Math.sin(ang) * rr };
      const d = Math.hypot(one.tgt.x - one.x, one.tgt.z - one.z);
      if (d > 60) { one.tgt.x = one.x + (one.tgt.x - one.x) * 60 / d; one.tgt.z = one.z + (one.tgt.z - one.z) * 60 / d; }
      one.dwell = 4 + one.rnd() * 20;
    } else {
      one.tgt = null;
      one.dwell = (state === 'lie' ? 25 : state === 'browse' ? 8 : 5) * (0.6 + one.rnd() * 1.2);
    }
  }
  // may the animal stand at (x, z)? not in water, not on a wall
  function landOk(one, x, z) {
    const h = ground(x, z);
    if (h <= waterH(x, z) + 0.2) return false;
    const d = Math.max(1.2, one.a.length * 0.6);
    const s = Math.max(Math.abs(ground(x + d, z) - h), Math.abs(ground(x, z + d) - h)) / d;
    return s < 0.53;                                  // 28 degrees
  }
  function landStep(one, dt) {
    one.t += dt;
    const P = one.H.player;
    const mv = one.H.step(dt);
    if (one.state === 'walk' && one.tgt) {
      // the heading turns toward the target; the STEP is the clip's own
      let want = Math.atan2(one.tgt.x - one.x, one.tgt.z - one.z);
      let e = want - one.hd;
      while (e > Math.PI) e -= TWO_PI;
      while (e < -Math.PI) e += TWO_PI;
      const turn = (one.a.mood && one.a.mood.turn) || 0.6;
      one.hd += clamp(e, -turn * dt, turn * dt);
      if (mv && (mv[0] || mv[2])) {
        _V.set(mv[0], 0, mv[2]).applyQuaternion(one.H.obj.quaternion);
        const nx = one.x + _V.x, nz = one.z + _V.z;
        if (landOk(one, nx, nz) && Math.hypot(nx - one.spot.x, nz - one.spot.z) < one.spot.r * 1.25) {
          one.x = nx; one.z = nz;
        } else {
          one.hd += (one.rnd() < 0.5 ? -1 : 1) * 0.9;   // refused: turn away and try again
          one.tgt = null;
          one.dwell = Math.min(one.dwell, one.t + 1.5);
        }
      }
      if (Math.hypot(one.tgt ? one.tgt.x - one.x : 0, one.tgt ? one.tgt.z - one.z : 0) < 2.5) one.dwell = one.t;
    } else if (one.state === 'trans' && mv && (mv[0] || mv[2])) {
      // a transition that shifts the body (a bear lies down a metre to one
      // side) moves the animal, which is the point of extracting the root
      _V.set(mv[0], 0, mv[2]).applyQuaternion(one.H.obj.quaternion);
      if (landOk(one, one.x + _V.x, one.z + _V.z)) { one.x += _V.x; one.z += _V.z; }
    }
    // the pose on the ground
    const y = ground(one.x, one.z);
    one.H.obj.position.set(one.x, y, one.z);
    normalAt(one.x, one.z, Math.max(1, one.a.length * 0.5), one.up);
    one.dir.set(Math.sin(one.hd), 0, Math.cos(one.hd));
    orient(one, one.dir, one.up, one.t < 0.05 ? 1 : Math.min(1, dt * 3));
    if (one.state === 'trans') {
      if (!P || P.done || one.t > one.dwell + 0.5) landStart(one, one.next || 'idle');
      return;
    }
    if (one.t >= one.dwell) {
      let want = landPick(one);
      if (want === one.state && want !== 'walk') want = (one.state === 'idle') ? 'browse' : 'idle';
      landEnter(one, want);
    }
  }

  // ---- SEA: the circuit, the dive, the blow -------------------------------
  // the depth of the dive cycle at phase p, and its rate — ONE law, so the
  // pitch is the motion's own derivative and not a second guess
  function diveAt(S, p) {
    const s = S.surface === undefined ? 0.2 : S.surface, w = 0.16;
    if (p < s) return 0;
    if (p < s + w) return sm((p - s) / w);
    if (p < 1 - w) return 1;
    return 1 - sm((p - (1 - w)) / w);
  }
  function seaStep(one, dt) {
    const S = one.a.sea || { speed: 3, depth: 12, cycle: 60, surface: 0.2, blow: 1, beam: 2 };
    const spot = one.spot;
    const r = Math.max(30, spot.r) * one.rJit;
    const om = S.speed / r;                              // the circuit's rate
    const flt = S.float === undefined ? Math.max(0.3, (one.a.dim[1] || 2) * 0.2) : S.float;
    one.a0 += om * dt;
    const cx = spot.x + Math.cos(one.a0) * r, cz = spot.z + Math.sin(one.a0) * r;
    const wl = waterH(cx, cz);
    const lvl = Number.isFinite(wl) ? wl : 0;
    const ph0 = one.phase;
    one.phase = (one.phase + dt / Math.max(4, S.cycle)) % 1;
    const d0 = diveAt(S, ph0), d1 = diveAt(S, one.phase);
    // `float` is how deep the PIVOT sits when the animal rests at the surface
    // (the pivot is the body's own centre, so a whale at the surface is not
    // half out of it); the dive goes from there to `depth`
    const depth = flt + d1 * Math.max(0, S.depth - flt);
    const rate = (d1 - d0) * Math.max(0, S.depth - flt) / Math.max(1e-4, dt);   // m/s down
    // the heading is the circuit's tangent; the pitch the dive's own slope
    const tx = -Math.sin(one.a0), tz = Math.cos(one.a0);
    const pitch = clamp(Math.atan2(-rate, Math.max(0.5, S.speed)), -0.7, 0.7);
    one.dir.set(tx * Math.cos(pitch), Math.sin(pitch), tz * Math.cos(pitch)).normalize();
    // a little roll into the turn, so a pod on a circuit is not a carousel
    const bank = clamp(S.speed * om / 9.81 * 3.0, -0.35, 0.35);
    one.up.set(Math.cos(one.a0) * -bank, 1, Math.sin(one.a0) * -bank).normalize();
    one.x = cx; one.z = cz;
    one.y = lvl - depth;
    one.H.obj.position.set(cx, one.y, cz);
    orient(one, one.dir, one.up, one.t > 0 ? Math.min(1, dt * 2) : 1);
    one.t += dt;
    one.depth = depth;
    // the body's own loop, its rate with the speed (the clip was authored at
    // one beat; a cruising whale beats slower than a hurrying one)
    if (!one.H.clip()) one.H.play('swim', { loop: true });
    if (one.H.player) one.H.player.rate = clamp(0.5 + S.speed / 4, 0.4, 1.6);
    one.H.step(dt);
    // THE LOOM: how far under the surface the body sits
    one.H.loomSet(depth);
    // THE WATER (the aeroplane's own): only when the back is out
    const beam = S.beam || 2;
    const up = depth < flt + beam * 0.35;               // the back is through
    // THE FIELD IS ASKED FOR, not assumed: it is the aeroplane's, and it only runs when the
    // aeroplane is itself near water - so a surfaced animal within 150 m of the eye asks, and a
    // landplane low over a pod gets the wake and the splash as well (app.js honours the ask for
    // half a second). Nothing happens if the eye is far: a whale alone in the ocean costs nothing.
    if (up && ctx.wantWater && eye) { const e = eye(); if (e && Math.hypot(cx - e.x, cz - e.z) < 150) ctx.wantWater(); }
    if (up && ctx.stamp && stats.stamps < STAMP_BUDGET) {
      const wet = clamp(1 - (depth - flt) / (beam * 0.35), 0, 1);
      ctx.stamp(cx, cz, beam * 1.1, -0.05 - 0.16 * wet, 0.25 * wet, 'press');
      stats.stamps++;
      if (one.rnd() < 0.35) {
        const bx = cx - tx * one.a.length * 0.3, bz = cz - tz * one.a.length * 0.3;
        ctx.stamp(bx, bz, beam * 0.7, 0, 0.5 * wet, 'foam');
        stats.stamps++;
      }
    }
    // BREAKING OUT: the frame the back comes through, a ring and a burst
    if (up && !one.wasUp) {
      if (ctx.stamp && stats.stamps < STAMP_BUDGET) {
        ctx.stamp(cx, cz, beam * 1.8, -0.35, 0.7, 'ring');
        stats.stamps++;
      }
      if (ctx.spray) {
        const n = Math.min(90, Math.round(14 * beam));
        for (let k = 0; k < n; k++) {
          const ang = one.rnd() * TWO_PI, rr = beam * (0.5 + one.rnd());
          ctx.spray(0, cx + Math.cos(ang) * rr, lvl + 0.1, cz + Math.sin(ang) * rr,
                    Math.cos(ang) * (1 + 2 * one.rnd()) + tx * S.speed * 0.3,
                    1.4 + 1.8 * one.rnd(),
                    Math.sin(ang) * (1 + 2 * one.rnd()) + tz * S.speed * 0.3);
        }
      }
      // THE BLOW: the plume, on the village chimney's own recipe
      if (window.PLUME && S.blow > 0) {
        if (!one.plume) {
          one.plume = window.PLUME.make(THREE, Object.assign({}, window.PLUME.PRESETS.blow,
            { rise: 2.2 * S.blow + 3.5, spread: 0.9 * S.blow + 1.0, k: 0.55 + 0.1 * S.blow }));
          root.add(one.plume.mesh);
        }
        const w = ctx.wind ? ctx.wind() : [0, 0];
        const hx = cx + tx * one.a.length * 0.33, hz = cz + tz * one.a.length * 0.33;
        one.plume.fire(hx, lvl + 0.2, hz, (w[0] || 0) * 0.12 + tx * 0.2, (w[1] || 0) * 0.12 + tz * 0.2);
        stats.blows++;
      }
    }
    one.wasUp = up;
    if (one.plume) { one.plume.step(dt); if (ctx.lit) one.plume.lit(ctx.lit()); }
  }

  // ---- AIR: the flocks ----------------------------------------------------
  // the V, in the flock's own frame: (across, up, along) in metres
  function vSlot(i, span) {
    if (i === 0) return [0, 0, 0];
    const k = Math.ceil(i / 2), s = (i % 2) ? 1 : -1;
    return [s * k * span * 1.1, (k % 2 ? 0.6 : -0.4) * span * 0.25, -k * span * 1.3];
  }
  function flockStep(F, dt) {
    F.t += dt;
    // the track: a straight run with a slow wander in heading and height
    F.hd += Math.sin(F.t * 0.09 + F.seed) * 0.05 * dt;
    const sp = F.speed;
    if (F.centre) {                                    // a PLACED flock circles its hotspot
      F.a += sp / Math.max(40, F.r) * dt;
      F.x = F.centre[0] + Math.cos(F.a) * F.r;
      F.z = F.centre[1] + Math.sin(F.a) * F.r;
      F.hd = -F.a;                                     // the tangent of (cos a, sin a) is (-sin a, cos a)
      F.y = F.base + Math.sin(F.t * 0.13 + F.seed) * 8;
    } else {
      F.x += Math.sin(F.hd) * sp * dt;
      F.z += Math.cos(F.hd) * sp * dt;
      F.y = F.base + Math.sin(F.t * 0.11 + F.seed) * 12;
    }
    const cs = Math.cos(F.hd), sn = Math.sin(F.hd);
    const gy = ground(F.x, F.z);
    const y = Math.max(F.y, gy + 25);
    for (const one of F.ones) {
      if (!one.H.ready) continue;
      const o = one.slot;
      one.x = F.x + o[0] * cs + o[2] * sn;
      one.z = F.z - o[0] * sn + o[2] * cs;
      one.y = y + o[1] + Math.sin(F.t * 1.7 + one.i * 1.3) * 0.5;
      one.H.obj.position.set(one.x, one.y, one.z);
      one.dir.set(sn, 0, cs);
      one.up.set(0, 1, 0);
      orient(one, one.dir, one.up, 1);
      if (!one.H.clip()) one.H.play('flap', { loop: true, at: one.rnd() * 0.6 });
      if (one.H.player) one.H.player.rate = one.rate;
      one.H.step(dt);
    }
  }

  // ---- the herds ----------------------------------------------------------
  const specOf = s => JSON.stringify([s.key, s.x, s.z, s.n, s.r, s.yaw || 0]);
  function drop(h) {
    for (const one of h.ones) {
      if (one.plume) one.plume.dispose();
      one.H.dispose();
    }
    h.ones.length = 0;
  }
  // sync(spots): the hotspots the record holds. Rebuilt only where the record
  // changed, so a live edit of one hotspot never re-sows another.
  function sync(spots) {
    const want = new Map();
    for (const s of spots || []) if (s && s.key) want.set(s.id, s);
    for (const [id, h] of HERDS) {
      const s = want.get(id);
      if (!s || specOf(s) !== h.spec) { drop(h); HERDS.delete(id); }
    }
    for (const [id, s] of want) {
      if (HERDS.has(id)) continue;
      const a = window.ANIMALS ? window.ANIMALS.reg(s.key) : null;
      if (!a) continue;
      const n = Math.max(1, Math.min(24, s.n | 0 || 1));
      const h = { key: s.key, spec: specOf(s), ones: [], kind: a.kind, flock: null };
      if (a.kind === 'air') {
        // `dy` IS the height when the author gave one (the editor's own row),
        // not an addition to a default: a flock asked for at 45 m flies at 45
        const F = { t: 0, seed: fnv(id) % 100, x: s.x, z: s.z, y: 0, base: ground(s.x, s.z) + (s.dy > 0 ? s.dy : 60),
                    hd: s.yaw || 0, speed: (a.air && a.air.speed) || 11, a: 0, r: Math.max(60, s.r || 120),
                    centre: [s.x, s.z], ones: [] };
        for (let i = 0; i < n; i++) {
          const one = makeOne(s, i);
          if (!one) continue;
          one.slot = vSlot(i, a.length);
          one.rate = 0.85 + one.rnd() * 0.4;
          F.ones.push(one); h.ones.push(one);
        }
        h.flock = F;
      } else {
        for (let i = 0; i < n; i++) {
          const one = makeOne(s, i);
          if (!one) continue;
          if (a.kind === 'land') landStart(one, 'idle');
          h.ones.push(one);
        }
      }
      HERDS.set(id, h);
    }
    stats.herds = HERDS.size;
    stats.animals = 0;
    for (const [, h] of HERDS) stats.animals += h.ones.length;
  }

  // ---- the ambient flocks (the world's, not a record's) -------------------
  // `ambient(n)`: keep n flocks alive within the eye's ring, crossing.
  let ambientN = 0, ambientKey = null, ambientSeed = 1;
  function ambient(n, key) {
    ambientN = n | 0;
    ambientKey = key || (ANI() ? (ANI().list('air')[0] || {}).key : null);
  }
  function ambientTick(dt) {
    if (!ambientN || !ambientKey || !eye || !ANI() || !ANI().reg(ambientKey)) return;   // the ambient ring IS the eye: no eye, no flocks
    const e = eye();
    for (let i = FLOCKS.length - 1; i >= 0; i--) {
      const F = FLOCKS[i];
      if (Math.hypot(F.x - e.x, F.z - e.z) > 1600) {
        for (const one of F.ones) one.H.dispose();
        FLOCKS.splice(i, 1);
      }
    }
    while (FLOCKS.length < ambientN) {
      const a = ANI().reg(ambientKey);
      const rnd = mulberry32(ambientSeed = (ambientSeed * 1664525 + 1013904223) >>> 0);
      const b = rnd() * TWO_PI, R = 1150 + rnd() * 200;
      const x = e.x + Math.cos(b) * R, z = e.z + Math.sin(b) * R;
      // across the eye, not at it: the bearing back plus a broad offset
      const hd = Math.atan2(e.x - x, e.z - z) + (rnd() - 0.5) * 1.5;
      const n = 3 + Math.floor(rnd() * 6);
      const spot = { id: 'amb' + (ambientSeed & 0xffff), key: ambientKey, x, z, n, r: 0 };
      const F = { t: 0, seed: rnd() * 100, x, z, y: 0, base: ground(x, z) + 70 + rnd() * 160,
                  hd, speed: ((a.air && a.air.speed) || 11) * (0.8 + rnd() * 0.5),
                  a: 0, r: 0, centre: null, ones: [] };
      for (let k = 0; k < n; k++) {
        const one = makeOne(spot, k);
        if (!one) break;
        one.slot = vSlot(k, a.length);
        one.rate = 0.85 + one.rnd() * 0.4;
        F.ones.push(one);
      }
      if (!F.ones.length) return;
      FLOCKS.push(F);
    }
  }

  // ---- the clock ----------------------------------------------------------
  function tick(dt) {
    if (!(dt > 0)) dt = 0;
    dt = Math.min(0.1, dt);
    T += dt;
    stats.stamps = 0;
    stats.shown = 0;
    const e = eye ? eye() : null;
    for (const [, h] of HERDS) {
      const reach = REACH[h.kind] || 1200;
      if (h.flock) {
        const on = !e || Math.hypot(h.flock.x - e.x, h.flock.z - e.z) < reach;
        for (const one of h.ones) one.H.obj.visible = on;
        if (on) { flockStep(h.flock, dt); stats.shown += h.ones.length; }
        continue;
      }
      for (const one of h.ones) {
        const on = !e || Math.hypot(one.x - e.x, one.z - e.z) < reach;
        one.H.obj.visible = on;
        if (!on) { if (one.H.loomSet) one.H.loomSet(0); continue; }
        if (!one.H.ready) continue;
        stats.shown++;
        if (h.kind === 'sea') seaStep(one, dt);
        else landStep(one, dt);
      }
    }
    ambientTick(dt);
    for (const F of FLOCKS) flockStep(F, dt);
    return stats.shown;
  }

  function dispose() {
    for (const [, h] of HERDS) drop(h);
    HERDS.clear();
    for (const F of FLOCKS) for (const one of F.ones) one.H.dispose();
    FLOCKS.length = 0;
    if (root.parent) root.parent.remove(root);
  }

  return { root, sync, tick, ambient, dispose, stats,
           herds: () => Array.from(HERDS.keys()),
           // the probe the gate and the bench read: every individual, flat
           list: () => {
             const out = [];
             for (const [id, h] of HERDS) for (const one of h.ones)
               out.push({ id, key: one.a.key, kind: h.kind, i: one.i, x: one.x, y: one.H.obj.position.y,
                          z: one.z, hd: one.hd, state: one.state, depth: one.depth, size: +(one.size || 1).toFixed(3),
                          clip: one.H.clip() ? one.H.clip().key : null, shown: one.H.obj.visible });
             for (const F of FLOCKS) for (const one of F.ones)
               out.push({ id: 'ambient', key: one.a.key, kind: 'air', i: one.i, x: one.x, y: one.y, z: one.z,
                          hd: F.hd, state: 'fly', depth: 0, clip: one.H.clip() ? one.H.clip().key : null, shown: true });
             return out;
           } };
};

if (typeof window !== 'undefined') window.ANIMAL_RUN = AR;
if (typeof module !== 'undefined' && module.exports) module.exports = AR;
})();
