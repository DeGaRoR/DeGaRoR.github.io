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
//   through where the pair exists and an eased cross-fade, as long as the head
//   has to travel, where it does not (animals.js, ANIMALS-MOTION). A walking
//   animal advances at the CLIP'S OWN measured ground speed (tools/animal_prep.py
//   took the root's travel out of the frames and put it in `travel`), so the feet
//   do not skate, and it TURNS at that speed over a radius of its own length
//   (half of it in a hard turn) - never on a standing pose; its y is the ground
//   under it and its attitude the ground's normal, low-passed. A step into water,
//   up a slope over 28 deg, or out of the hotspot's radius is refused and the
//   animal turns on the spot, stepping, toward the middle. Mostly idle, as asked.
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
//
// THE SOUND'S READER (G1705, SND-ANIMALS; SOUND-2026-10-04 §6.3): `sound(out)` writes
// one row of AR.SOUND.ROW (12) per individual into a caller's Float64Array -
//   [species, x, y, z, vx, vy, vz, state, event, herd, shown, length]
// species: the index in AR.SOUND.SPECIES (-1 an animal the sound does not know);
// x y z: where its voice is - a land animal's head, a sea animal's BLOWHOLE (at the
// surface while it is up), a bird itself; v: its velocity (the sea's circuit, the
// flock's track; a land animal 0); state: AR.SOUND.STATE (idle / walk / surfaced /
// submerged / flying); event: the run's clock (`clock()`) at its last EVENT - a sea
// animal's BLOW (the frame the back broke through and the plume was fired), a land
// animal's CALL opportunity (it changed what it does: the herd decides whether it
// calls); -1 none (AR.SOUND.EV names the two). A caller that keeps the clock it read
// last time has this frame's events: event > that clock. (The clock is compared by
// the caller, never handed in: a double passed to a call is a heap box a frame.)
// herd: an integer per herd / pod / flock (placed or ambient), stable while it
// lives; shown: stepped and drawn (in reach); length: its own, x its size.
// READ ONLY: nothing about an animal is written, no random is drawn, no joint is
// touched (the user's G498 ruling). ALLOCATION-FREE: Map.forEach with callbacks
// made once, rows into the caller's array. The two marks it reads (blowT, callT)
// are written where the behaviour already acts and change nothing it does.
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
// THE SOUND'S VOCABULARY (G1705): the rows `sound()` writes (see the header)
const SOUND = { ROW: 12, SPECIES: ['bear', 'elk', 'doe', 'orca', 'whale', 'bird'],
                STATE: { idle: 0, walk: 1, surfaced: 2, submerged: 3, flying: 4 }, EV: { BLOW: 1, CALL: 2 } };
AR.SOUND = SOUND;

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
  const stats = { herds: 0, animals: 0, shown: 0, far: 0, stamps: 0, blows: 0 };
  let T = 0;
  let HSEQ = 0;                     // the herds' integers for the sound (G1705)

  // THE WAKES (SWIMMERS): the layer the swimmers' hulls write, made when the first one is sown (wakes.js, asked for)
  let WK = null;
  function wakesOn() { if (!WK && typeof window !== 'undefined' && window.WAKES) WK = window.WAKES.make(THREE, { parent: root, waterH, eye }); }

  // THE BODIES UNDER THE SURFACE (SWIMMERS): the nearest sea animals with any of the body under water, as capsules for
  // the water's column (water.js setSubmerged): the water over a whale is the water down to the whale, so it shows,
  // drawn as itself, tinted by the sea it is under. One owner name per runner; nothing allocated a frame.
  // THE BUDGET (16 Nov): the water takes SUB_MAX capsules. Every body under the surface gets its trunk first (a pod of 12 is
  // seen through the sea, never half of it - the first slot's 6 nearest left the rest under the bed's full column); what is
  // left goes, nearest first, to the head and the tail stock (ANIMALS.seaCore's seg), so the near bodies show whole.
  const SUB_MAX = 12, SUB_PX = 2, SUB_PXRAD = 1094;   // (the ladder's eye: 1094 px per radian at 1080p)
  const SUBK = 'animals:' + Math.random().toString(36).slice(2, 8), SUBL = [], SUBP = [], SUBA = [];
  for (let i = 0; i < SUB_MAX; i++) SUBP.push({ x: 0, y: 0, z: 0, r: 1, ax: 0, ay: 0, az: 1, h: 1, d2: 0 });
  const bySd2 = (a, b) => a._sd2 - b._sd2;
  const _SA = new THREE.Vector3(), _SU = new THREE.Vector3(), _SP = new THREE.Vector3(), _SQ = new THREE.Vector3();
  const _SM = new THREE.Matrix4(), _SMb = new THREE.Matrix4();
  // a section's capsule (seg: a, b, r in the handle's frame; A, B on its bone) into q, world metres
  function segCap(q, one, seg, d2) {
    const H = one.H, sz = one.size || 1, oq = H.obj.quaternion, op = H.obj.position;
    const bone = seg.A && H.inst && H.inst.meshes[seg.mi] && H.inst.meshes[seg.mi].skeleton ? H.inst.meshes[seg.mi].skeleton.bones[seg.bi] : null;
    if (bone) {
      // the bone's pose relative to the handle (both the renderer's matrices, the same frame): the stock beats with the flukes
      _SM.copy(H.obj.matrixWorld).invert(); _SMb.multiplyMatrices(_SM, bone.matrixWorld);
      _SP.fromArray(seg.A).applyMatrix4(_SMb); _SQ.fromArray(seg.B).applyMatrix4(_SMb);
    } else { _SP.fromArray(seg.a); _SQ.fromArray(seg.b); }
    _SP.applyQuaternion(oq).multiplyScalar(sz).add(op); _SQ.applyQuaternion(oq).multiplyScalar(sz).add(op);
    q.x = (_SP.x + _SQ.x) / 2; q.y = (_SP.y + _SQ.y) / 2; q.z = (_SP.z + _SQ.z) / 2;
    _SQ.sub(_SP);
    const len = _SQ.length();
    if (len > 1e-4) { q.ax = _SQ.x / len; q.ay = _SQ.y / len; q.az = _SQ.z / len; } else { _SA.set(0, 0, 1).applyQuaternion(oq); q.ax = _SA.x; q.ay = _SA.y; q.az = _SA.z; }
    q.h = len / 2; q.r = seg.r * sz; q.d2 = d2;
  }
  function submerged(e) {
    const W = (typeof window !== 'undefined' && window.WATER && window.WATER.setSubmerged) ? window.WATER : null;
    if (!W && !ctx.submerged) return;
    SUBL.length = 0; SUBA.length = 0;
    // THE GUARD (16 Nov, A0 on the slot-3 cost: +3.6 ms over open sea with the swimmers hidden): the water's loop runs only
    // for a body that is drawn - the runner's root shown up its parents, the trunk at least SUB_PX across. None: the list
    // goes empty, uWSubN 0, the shader's loop costs nothing.
    let shownUp = true;
    for (let p = root; p; p = p.parent) if (p.visible === false) { shownUp = false; break; }
    if (shownUp) for (const [, h] of HERDS) {
      if (h.kind !== 'sea') continue;
      for (const one of h.ones) {
        if (!one.H.core || !one.H.obj.visible || !(one.depth > 0)) continue;
        one._sd2 = e ? (one.x - e.x) ** 2 + (one.z - e.z) ** 2 + (one.y - (e.y || 0)) ** 2 : 0;
        const rr = one.H.core.r * (one.size || 1) * SUB_PXRAD * 2;
        if (e && one._sd2 * SUB_PX * SUB_PX > rr * rr) continue;            // under SUB_PX across: the sea alone
        SUBA.push(one);
      }
    }
    SUBA.sort(bySd2);
    const n = Math.min(SUBA.length, SUB_MAX);
    let k = 0, spare = SUB_MAX - n;
    for (let i = 0; i < n; i++) {
      const one = SUBA[i], C = one.H.core, d2 = one._sd2, q = SUBP[k++];
      // the trunk's own capsule (ANIMALS.seaCore: inside the skin, fitted once per species) through the body's frame -
      // its pitch and bank included (this frame's quaternion)
      const sz = one.size || 1, oq = one.H.obj.quaternion, op = one.H.obj.position;
      _SA.set(0, 0, 1).applyQuaternion(oq); _SU.set(0, 1, 0).applyQuaternion(oq);
      q.x = op.x + (_SU.x * C.cy + _SA.x * C.cz) * sz; q.y = op.y + (_SU.y * C.cy + _SA.y * C.cz) * sz; q.z = op.z + (_SU.z * C.cy + _SA.z * C.cz) * sz;
      q.ax = _SA.x; q.ay = _SA.y; q.az = _SA.z; q.r = C.r * sz; q.h = C.h * sz; q.d2 = d2;
      SUBL.push(q);
    }
    for (let i = 0; i < n; i++) {
      const one = SUBA[i], segs = one.H.core.seg;
      if (!segs || !segs.length || spare < segs.length) continue;
      for (const sg of segs) { const q = SUBP[k++]; segCap(q, one, sg, one._sd2); SUBL.push(q); }
      spare -= segs.length;
    }
    if (ctx.submerged) ctx.submerged(SUBL); else W.setSubmerged(SUBK, SUBL);
  }

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
                  // the sound's marks (G1705): the run's clock at the last blow / call opportunity, the herd, the species
                  blowT: -1, callT: -1, herd: 0, F: null, sp: SOUND.SPECIES.indexOf(spot.key),
                  up: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(0, 0, 1),
                  // THE TURN (ANIMALS-MOTION): the smoothed ground normal, the stride's rate, the ground speed, the yaw rate
                  upS: new THREE.Vector3(0, 1, 0), posed: false, rho: 1, vs: 0, w: 0, pivot: false, pivotT: 0, via: null,
                  // THE SWIMMING (SWIMMERS): declared HERE, for every individual - fields added later give the sea animals
                  // their own object shapes, and the sound's reader (G1705) then reads them through boxed doubles (GATE AUDIO
                  // ANIALLOC: 3.7 B a read)
                  v: 0, vy: 0, bank: 0, pitch: 0, dTarget: 0, br: null, lead: null, off: null, lag: 1, wid: null,
                  upT: 0, upDone: false, _sd2: 0, farPosed: false };   // (_sd2: the water's sort key, submerged())
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
    // AN ANIMAL LIES DOWN FROM A STAND (ANIMALS-MOTION): the asset's Stand_to_Lying starts from the standing pose, so a
    // walker or a grazer that wants to lie stands first (the machine picks again from there) - never a fade from a
    // walk straight into a lying body
    if (state === 'lie' && one.state !== 'idle' && one.state !== 'lie' && CLIPS(one.a, 'toLie').length) state = 'idle';
    // the asset's own transition, where the pair has one: played through, and
    // the state entered when it ends (`next`); a grazer sets off through the same stand-to-walk as a stander
    const via = ((one.state === 'idle' || one.state === 'browse') && state === 'walk') ? 'toWalk'
      : (one.state === 'idle' && state === 'lie') ? 'toLie'
      : (one.state === 'lie' && state !== 'lie') ? 'fromLie' : null;
    if (via && CLIPS(one.a, via).length) {
      one.state = 'trans'; one.next = state; one.t = 0; one.via = via;
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
    one.pivot = false; one.pivotT = 0;
    if (state !== 'lie') one.callT = T;             // a call opportunity (G1705): it stands, walks or browses anew
    const c = H_clip(one, state === 'walk' ? 'walk' : state);
    if (c) one.H.play(c, { fade: 0.25, loop: true, rate: 1 });
    if (state === 'walk') {
      one.tgt = landTarget(one, false);
      one.vs = 0; one.rho = 1;
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
  // THE TURN (ANIMALS-MOTION, 15 Nov 2026). The user: "no walking animation when they turn". G498 turned a walker at a
  // fixed 0.5-0.7 rad/s whatever its speed - a bear at 0.42 m/s swung its 2.2 m body round a 0.84 m circle, its feet
  // dragged sideways - and a refused step added 0.9 rad AT ONCE, the body then spun after it on a treading clip. Now:
  //   ARC    the yaw rate is the GROUND SPEED over a turn radius: v / R, R = the body's length going straight, half of
  //          it in a hard turn (the stride shortens to TURN_RATE of itself for that); v is the clip's own travel, so a
  //          walker that is not moving does not turn, and a walk fading out turns less as it slows.
  //   PIVOT  a step refused (water, a wall of a slope, the hotspot's edge) turns the animal ON THE SPOT toward a new
  //          target: the walk clip stepping at the rate the turn asks (the feet sweep the half-length at the turn's
  //          speed), no travel, until it faces the way; then it walks off.
  // Nothing else turns a land animal: idle, browse, lie and the transitions keep their heading.
  const TURN_RATE = 0.65;                            // the stride in a hard turn, x the clip's own
  const PIVOT_RATE = 0.6;                            // the stepping rate on the spot, x the clip's own
  function landTarget(one, home) {
    // somewhere else inside the hotspot, never more than 60 m off; `home`: toward the middle (a refused step). A place
    // it may stand on, in six tries (a hotspot with a pond in it: never a walk to the middle of the pond)
    const t = { x: one.x, z: one.z };
    for (let k = 0; k < 6; k++) {
      const ang = one.rnd() * TWO_PI, rr = one.spot.r * (home ? 0.5 : 1) * Math.sqrt(one.rnd());
      t.x = one.spot.x + Math.cos(ang) * rr; t.z = one.spot.z + Math.sin(ang) * rr;
      const d = Math.hypot(t.x - one.x, t.z - one.z);
      if (d > 60) { t.x = one.x + (t.x - one.x) * 60 / d; t.z = one.z + (t.z - one.z) * 60 / d; }
      if (landOk(one, t.x, t.z)) break;
    }
    return t;
  }
  function landStep(one, dt) {
    one.t += dt;
    const P = one.H.player;
    const walking = one.state === 'walk' && !!one.tgt;
    const mv = one.H.step(dt);
    const gait = !!(P && P.cur && (P.cur.role === 'walk' || P.cur.role === 'trot'));
    one.w = 0;
    if (walking) {
      let e = Math.atan2(one.tgt.x - one.x, one.tgt.z - one.z) - one.hd;
      while (e > Math.PI) e -= TWO_PI;
      while (e < -Math.PI) e += TWO_PI;
      const cap = (one.a.mood && one.a.mood.turn) || 0.6;
      const L = Math.max(0.5, one.a.length * (one.size || 1));
      const vc = gait && P.cur.speed > 0 ? P.cur.speed : 0.5;     // the clip's own measured ground speed, m/s
      if (one.pivot) {
        // PIVOT: the turn's rate is the stepping rate's - the feet sweep the half-length as fast as the stride does
        const wmax = Math.min(cap, PIVOT_RATE * vc / (0.5 * L));
        one.w = clamp(2 * e, -wmax, wmax);
        if (gait) P.rate = Math.max(0.25, Math.abs(one.w) * 0.5 * L / vc);
        one.hd += one.w * dt;
        one.pivotT += dt;
        if (Math.abs(e) < 0.3) { one.pivot = false; one.vs = 0; }
        else if (one.pivotT > TWO_PI / Math.max(0.05, wmax) + 2) one.dwell = one.t;   // never a carousel
      } else {
        // ARC: the stride shortens in a hard turn, and the turn is the ground speed over the radius
        const k = sm(Math.min(1, Math.abs(e) / (Math.PI / 2)));
        one.rho += ((1 - (1 - TURN_RATE) * k) - one.rho) * Math.min(1, dt * 2);
        if (gait) P.rate = one.rho;
        let v = 0;
        if (mv && (mv[0] || mv[2])) {
          _V.set(mv[0], 0, mv[2]).applyQuaternion(one.H.obj.quaternion);
          const nx = one.x + _V.x, nz = one.z + _V.z;
          if (landOk(one, nx, nz) && Math.hypot(nx - one.spot.x, nz - one.spot.z) < one.spot.r * 1.25) {
            one.x = nx; one.z = nz;
            v = Math.hypot(_V.x, _V.z) / Math.max(1e-4, dt);
          } else {
            // refused: a new way, toward the middle of the hotspot, turned to ON THE SPOT
            one.tgt = landTarget(one, true);
            one.pivot = true; one.pivotT = 0;
          }
        }
        one.vs += (v - one.vs) * Math.min(1, dt * 4);           // the ground speed, low-passed (a stride is not uniform)
        const R = L * (1 - 0.5 * k);
        const wmax = Math.min(cap, one.vs / R);
        one.w = clamp(1.5 * e, -wmax, wmax);
        one.hd += one.w * dt;
      }
      if (Math.hypot(one.tgt.x - one.x, one.tgt.z - one.z) < 2.5) one.dwell = one.t;
    } else if (mv && (mv[0] || mv[2])) {
      // a transition that shifts the body (a bear lies down a metre to one side) moves the animal, which is the point
      // of extracting the root; so does a walk fading out under a stand (its legs slow, the ground still passes)
      _V.set(mv[0], 0, mv[2]).applyQuaternion(one.H.obj.quaternion);
      if (landOk(one, one.x + _V.x, one.z + _V.z) && Math.hypot(one.x + _V.x - one.spot.x, one.z + _V.z - one.spot.z) < one.spot.r * 1.25) { one.x += _V.x; one.z += _V.z; }
    }
    // the pose on the ground: the heading AS IS (it only ever moves by the law above), the ground's normal low-passed
    const y = ground(one.x, one.z);
    one.H.obj.position.set(one.x, y, one.z);
    normalAt(one.x, one.z, Math.max(1, one.a.length * 0.5), one.up);
    if (!one.posed) { one.upS.copy(one.up); one.posed = true; }
    else one.upS.lerp(one.up, Math.min(1, dt * 3)).normalize();
    one.dir.set(Math.sin(one.hd), 0, Math.cos(one.hd));
    orient(one, one.dir, one.upS, 1);
    if (one.state === 'trans') {
      // the transition ends when ITS CLIP does (paced, it may run longer than its nominal length), with a backstop.
      // Up from lying and off walking: through Stand_to_WalkSlow, from the stand Trans_Lying_to_Stand ends in - never a
      // fade from a stand straight into a stride (ANIMALS-MOTION)
      if (!P || P.done || one.t > one.dwell * 3 + 1) {
        const nx = one.next || 'idle';
        if (nx === 'walk' && one.via === 'fromLie' && CLIPS(one.a, 'toWalk').length) { one.state = 'idle'; landEnter(one, 'walk'); }
        else landStart(one, nx);
      }
      return;
    }
    if (one.t >= one.dwell) {
      let want = landPick(one);
      if (want === one.state && want !== 'walk') want = (one.state === 'idle') ? 'browse' : 'idle';
      landEnter(one, want);
    }
  }

  // ---- SEA: THE SWIMMING (SWIMMERS, 15 Nov 2026) ----------------------------------------------------------------
  // The user: "the orcas ... do not swim realistically ... the same for the whales and for everything that swims". G498
  // flew each animal round a circle about its hotspot with one dive cycle. Now (futureDesigns/SWIMMERS-2026-11-15.md):
  //   THE PATH    the pod's LEADER wanders to points inside the hotspot; it turns at most at speed / (2 x its length)
  //               (a 25 m whale does not pivot), and BANKS into the turn (the roll a turn of that rate and speed asks:
  //               atan(v w / g), x 2.5 for a body this long, smoothed). The members hold places off the leader (abreast
  //               and astern, a length or two apart), steering to them and easing their speed to keep station.
  //   THE BREATH  the leader's: a SERIES of breaths (an orca 2-4, a blue whale 3-5) - up at the surface for a few
  //               seconds (the blow fires as the back breaks it), a shallow arc under between them - then a TERMINAL
  //               DIVE to `depth` for most of the cycle. The members follow the leader's depth on their own spring, so a
  //               pod surfaces together but not in lockstep.
  //   THE BODY    the depth is a damped spring on the target, its rate limited to a dive angle (35 deg, 45 in a
  //               terminal dive); the PITCH is that rate over the speed - the arch is the motion. The fluke beat (the
  //               clip's rate) follows the speed, and beats harder going up.
  //   THE WAKE    every frame the body's vertical extent goes to the WAKES layer (wakes.js): it leaves a trail and the
  //               Kelvin arms only while the surface CROSSES it; a breach drops a ring.
  const SEA0 = { speed: 3, depth: 12, cycle: 60, surface: 0.2, blow: 1, beam: 2 };
  function seaLen(one) { return (one.a.length || 8) * (one.size || 1); }
  function seaSow(one, h, i) {
    const S = one.a.sea || SEA0, r = one.rnd;
    one.hd = r() * TWO_PI; one.v = S.speed; one.vy = 0; one.bank = 0; one.w = 0; one.pitch = 0;
    one.depth = S.depth * 0.5; one.dTarget = one.depth; one.wasUp = false;
    if (i === 0) {
      one.lead = null;
      one.br = { mode: 'dive', n: 0, t: 6 + r() * 20 };    // (a pod is found mid-dive: it surfaces within half a minute)
    } else {
      // a place off the leader: abreast at 1.1-1.5 lengths, the next ones astern, alternating sides
      const k = Math.ceil(i / 2), side = (i % 2) ? 1 : -1;
      one.lead = h.ones[0];
      one.off = [side * (1.1 + 0.4 * r()) * k, -(0.6 + 0.9 * r()) * (k - 0.5)];   // (across, along) in lengths
      one.lag = 0.8 + 0.4 * r();                          // its depth spring's own pace, x the leader's
      // it starts in its place
      const ld = one.lead, c = Math.cos(ld.hd), sn = Math.sin(ld.hd), Lw = seaLen(ld);
      one.x = ld.x + (c * one.off[0] + sn * one.off[1]) * Lw; one.z = ld.z + (-sn * one.off[0] + c * one.off[1]) * Lw;
      one.hd = ld.hd;
    }
  }
  function seaTarget(one) {
    const ang = one.rnd() * TWO_PI, rr = one.spot.r * 0.85 * Math.sqrt(one.rnd());
    one.tgt = { x: one.spot.x + Math.cos(ang) * rr, z: one.spot.z + Math.sin(ang) * rr };
  }
  // the leader's breathing: the target depth now, and the series' clock
  function seaBreath(one, S, flt, dt) {
    const B = one.br, isOrca = (S.cycle || 60) < 70;
    // at the surface the breath's seconds count only once the back is there (a rise from 28 m takes its own time)
    if (B.mode !== 'up' || one.depth < flt + (S.beam || 2) * 0.2) B.t -= dt;
    if (B.mode === 'dive') {
      one.dTarget = S.depth;
      if (B.t <= 0) { B.mode = 'up'; B.n = (isOrca ? 2 : 3) + Math.floor(one.rnd() * 3); B.t = isOrca ? 3 : 4.5; }
    } else if (B.mode === 'up') {
      one.dTarget = flt * 0.6;                            // (aimed a little high: the spring settles ON the surface, not under it)
      if (B.t <= 0) {
        if (--B.n > 0) { B.mode = 'arc'; B.t = (isOrca ? 5 : 11) + one.rnd() * (isOrca ? 6 : 7); }
        else { B.mode = 'dive'; B.t = (S.cycle || 60) * (0.55 + 0.3 * one.rnd()); }
      }
    } else {                                                 // 'arc': a shallow pass under, between two breaths
      one.dTarget = flt + (S.beam || 2) * 1.8;
      if (B.t <= 0) { B.mode = 'up'; B.t = isOrca ? 3 : 4.5; }
    }
  }
  function seaStep(one, dt) {
    const S = one.a.sea || SEA0;
    const L = seaLen(one);
    const flt = S.float === undefined ? Math.max(0.3, (one.a.dim[1] || 2) * 0.2) : S.float;
    const beam = (S.beam || 2) * (one.size || 1);
    // THE PATH: the leader to its point; a member to its place off the leader
    let want, vWant = S.speed;
    if (!one.lead) {
      if (!one.tgt || Math.hypot(one.tgt.x - one.x, one.tgt.z - one.z) < Math.max(20, 2 * L)) seaTarget(one);
      want = Math.atan2(one.tgt.x - one.x, one.tgt.z - one.z);
      seaBreath(one, S, flt, dt);
      if (one.br.mode === 'up') vWant *= 0.8;               // slower at the surface, breathing
    } else {
      const ld = one.lead, c = Math.cos(ld.hd), sn = Math.sin(ld.hd), Lw = seaLen(ld);
      // the place: across (right = (cos hd, -sin hd)) and along (forward = (sin hd, cos hd)), in the leader's lengths
      const px = ld.x + (c * one.off[0] + sn * one.off[1]) * Lw, pz = ld.z + (-sn * one.off[0] + c * one.off[1]) * Lw;
      const ex = px - one.x, ez = pz - one.z, d = Math.hypot(ex, ez);
      // far from its place: head for it; near: swim the leader's heading, nudged toward the place
      const toP = Math.atan2(ex, ez), blend = clamp(d / (2 * L), 0, 1);
      let e0 = toP - ld.hd; while (e0 > Math.PI) e0 -= TWO_PI; while (e0 < -Math.PI) e0 += TWO_PI;
      want = ld.hd + e0 * blend;
      const along = ex * Math.sin(ld.hd) + ez * Math.cos(ld.hd);          // + ahead of me: hurry
      vWant = clamp((ld.v || S.speed) + along * 0.15, S.speed * 0.6, S.speed * 1.5);
      // ITS OWN BREATH while the leader breathes: up to the surface, its own seconds there, then under again (a
      // follower that only tracked the leader's depth would lag it and never break the surface)
      const lUp = ld.br && ld.br.mode === 'up';
      if (!lUp) { one.upT = 0; one.upDone = false; one.dTarget = ld.dTarget; }
      else if (!one.upDone) {
        one.dTarget = flt * 0.6;
        if (one.depth < flt + (S.beam || 2) * 0.2 && (one.upT = (one.upT || 0) + dt) > ((S.cycle || 60) < 70 ? 2.5 : 3.5)) one.upDone = true;
      } else one.dTarget = flt + (S.beam || 2) * 1.2;
    }
    // THE SEABED: never a dive through it (Jolene's shelf is 5-14 m deep, a blue whale's `depth` 28): the target and the
    // body stay a body's height over the bed under it
    // (no column at all - the bed above the surface, a pod an author put over the land, or the gate's synthetic island:
    // the bed is not known there, and the dive goes on as G498's did)
    const lv0 = waterH(one.x, one.z), bed0 = Number.isFinite(lv0) ? lv0 - ground(one.x, one.z) : Infinity;
    const bed = bed0 > flt + beam ? bed0 : Infinity;
    const floorD = Math.max(flt, bed - beam * 0.8);
    one.dTarget = Math.min(one.dTarget, floorD);
    let e = want - one.hd;
    while (e > Math.PI) e -= TWO_PI;
    while (e < -Math.PI) e += TWO_PI;
    one.v += (vWant - one.v) * Math.min(1, dt * 0.5);
    const wmax = one.v / (2 * L);
    const w = clamp(0.4 * e, -wmax, wmax);
    one.w = w;
    one.hd += w * dt;
    // THE BODY: the depth on a damped spring, its rate a dive angle at most; the pitch is the rate over the speed
    const wn = ((S.cycle || 60) < 70 ? 0.45 : 0.28) * (one.lead ? one.lag : 1);
    const dive = one.lead ? !!(one.lead.br && one.lead.br.mode === 'dive') : one.br.mode === 'dive';
    const vyMax = one.v * Math.tan((dive ? 45 : 35) * Math.PI / 180);
    one.vy += (wn * wn * (one.dTarget - one.depth) - 2 * wn * one.vy) * dt;
    one.vy = clamp(one.vy, -vyMax, vyMax);
    one.depth = Math.max(flt * 0.6, Math.min(Math.max(flt * 0.6, bed - beam * 0.5), one.depth + one.vy * dt));
    if (one.depth <= flt * 0.6 && one.vy < 0) one.vy = 0;
    const depth = one.depth;
    one.x += Math.sin(one.hd) * one.v * dt;
    one.z += Math.cos(one.hd) * one.v * dt;
    const cx = one.x, cz = one.z;
    const wl = waterH(cx, cz);
    const lvl = Number.isFinite(wl) ? wl : 0;
    const tx = Math.sin(one.hd), tz = Math.cos(one.hd);
    const pitch = clamp(Math.atan2(-one.vy, Math.max(0.5, one.v)), -0.8, 0.8);
    one.pitch += (pitch - one.pitch) * Math.min(1, dt * 2);
    one.dir.set(tx * Math.cos(one.pitch), Math.sin(one.pitch), tz * Math.cos(one.pitch)).normalize();
    // THE BANK: the roll this turn asks, smoothed; up = Y rolled about the track toward the turn's inside
    const bankW = clamp(Math.atan(one.v * w / 9.81) * 2.5, -0.45, 0.45);
    one.bank += (bankW - one.bank) * Math.min(1, dt * 1.5);
    const rx = Math.cos(one.hd), rz = -Math.sin(one.hd);    // the right, for a heading (sin hd, cos hd)
    one.up.set(-rx * Math.sin(one.bank), Math.cos(one.bank), -rz * Math.sin(one.bank)).normalize();
    one.y = lvl - depth;
    one.H.obj.position.set(cx, one.y, cz);
    orient(one, one.dir, one.up, 1);
    one.t += dt;
    // the fluke beat: the clip's rate from the speed, harder going up
    if (!one.H.clip()) one.H.play('swim', { loop: true });
    if (one.H.player) one.H.player.rate = clamp(0.35 + 0.65 * one.v / Math.max(0.5, S.speed) + Math.max(0, -one.vy) * 0.12, 0.35, 1.7);
    one.H.step(dt);
    // THE WAKE: the body's vertical extent, the surface crossing it or not (wakes.js decides; nothing is drawn under)
    if (WK) WK.hull(one.wid || (one.wid = 'sea:' + one.spot.id + ':' + one.i), { x: cx, z: cz, hd: one.hd, speed: one.v, beam, length: L,
      top: one.y + beam * 0.6, bottom: one.y - beam * 0.5 });
    // (THE LOOM is retired: the body is drawn as itself and the water knows where it is - setSubmerged in tick())
    // THE WATER (the aeroplane's own): only when the back is out
    // (beam: the body's own, x its size, above)
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
      if (S.blow > 0) one.blowT = T;                // the sound's mark (G1705): the frame the plume is fired below
      if (WK) WK.ring(cx, cz, beam * 0.9, Math.min(1, 0.4 + Math.max(0, -one.vy) * 0.4));                // the sound's mark (G1705): the frame the plume is fired below
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
      // THE BLOW: water, not smoke (16 Nov: the chimney's grey column read as "grey eggs") - plume.js's mist, sized by the
      // species' blow: an orca's bushy 2.5 m (blow 1.0), a blue whale's 9 m column (2.6). The mist is fired where the
      // blowhole broke the surface and stays in the AIR it was blown into: it drifts with the wind, not with the whale
      if (window.PLUME && S.blow > 0) {
        if (!one.plume) {
          one.plume = window.PLUME.make(THREE, Object.assign({}, window.PLUME.PRESETS.mist || window.PLUME.PRESETS.blow,
            { rise: 4.0 * S.blow - 1.4, spread: 1.1 * S.blow + 0.1, r0: 0.11 * S.blow + 0.01, k: 0.4 + 0.03 * S.blow }));
          root.add(one.plume.mesh);
        }
        const w = ctx.wind ? ctx.wind() : [0, 0];
        const hx = cx + tx * one.a.length * 0.33, hz = cz + tz * one.a.length * 0.33;
        one.plume.fire(hx, lvl + 0.2, hz, (w[0] || 0) * 0.6, (w[1] || 0) * 0.6);
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
      const h = { key: s.key, spec: specOf(s), ones: [], kind: a.kind, flock: null, n: ++HSEQ };
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
          one.herd = h.n; one.F = F;
          F.ones.push(one); h.ones.push(one);
        }
        h.flock = F;
      } else {
        for (let i = 0; i < n; i++) {
          const one = makeOne(s, i);
          if (!one) continue;
          if (a.kind === 'land') { landStart(one, 'idle'); one.callT = -1; }   // (being sown is not a call)
          if (a.kind === 'sea') { seaSow(one, h, h.ones.length); wakesOn(); }
          one.herd = h.n;
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
                  a: 0, r: 0, centre: null, ones: [], n: ++HSEQ };
      for (let k = 0; k < n; k++) {
        const one = makeOne(spot, k);
        if (!one) break;
        one.slot = vSlot(k, a.length);
        one.rate = 0.85 + one.rnd() * 0.4;
        one.herd = F.n; one.F = F;
        F.ones.push(one);
      }
      if (!F.ones.length) return;
      FLOCKS.push(F);
    }
  }

  // ---- the clock ----------------------------------------------------------
  // A HIDDEN ANIMAL LEAVES THE MATRIX WALK (PERF 2026-09-23): three composes every object with matrixAutoUpdate
  // every frame, shown or not, and a rigged skin is dozens of bones - 4 000 objects of the premises' 20 000, most of
  // them out of reach. Out of reach the whole rig stops composing; back in reach it composes again (its step poses it).
  const park = (obj, on) => {
    if (!obj || obj.userData.parked === !on) return;
    obj.userData.parked = !on;
    obj.traverse(o => { o.matrixAutoUpdate = on; o.matrixWorldAutoUpdate = on; });
  };
  function tick(dt) {
    if (!(dt > 0)) dt = 0;
    dt = Math.min(0.1, dt);
    T += dt;
    stats.stamps = 0;
    stats.shown = 0; stats.far = 0;
    const e = eye ? eye() : null;
    for (const [, h] of HERDS) {
      const reach = REACH[h.kind] || 1200;
      if (h.flock) {
        const on = !e || Math.hypot(h.flock.x - e.x, h.flock.z - e.z) < reach;
        for (const one of h.ones) { one.H.obj.visible = on; park(one.H.obj, on); }
        if (on) { flockStep(h.flock, dt); stats.shown += h.ones.length; }
        continue;
      }
      for (const one of h.ones) {
        const on = !e || Math.hypot(one.x - e.x, one.z - e.z) < reach;
        // FAR, NOT GONE (the user 15 Nov: "From the starting place of the cabin strip, all animals should show. We could
        // reduce their numbers if need be"): a land animal past its reach stays DRAWN where it stands, frozen - at 1.4 km
        // the ladder draws its static cut (ANIMALS-MOTION: the skin ends at 6 px, an elk at 456 m), so nothing that would
        // walk is seen standing still. It is posed once (on the ground, its heading), composed once, then parked: no step,
        // no matrix walk. Sea animals past theirs stay hidden (a frozen whale at the surface is a dead whale).
        if (!on && h.kind === 'land') {
          if (!one.H.ready) { one.H.obj.visible = false; continue; }
          if (!one.farPosed) {
            if (!one.posed) orient(one, one.dir, one.upS, 1);
            one.H.obj.visible = true; park(one.H.obj, true); one.H.obj.updateMatrixWorld(true); park(one.H.obj, false);
            one.farPosed = true;
          }
          one.H.obj.visible = true; stats.far++;
          continue;
        }
        one.farPosed = false;
        one.H.obj.visible = on; park(one.H.obj, on);
        if (!on) { if (one.H.loomSet) one.H.loomSet(0); continue; }
        if (!one.H.ready) continue;
        stats.shown++;
        if (h.kind === 'sea') seaStep(one, dt);
        else landStep(one, dt);
      }
    }
    ambientTick(dt);
    if (WK) WK.step(dt);
    submerged(e);
    for (const F of FLOCKS) flockStep(F, dt);
    return stats.shown;
  }

  // ---- THE SOUND'S READER (G1705) -----------------------------------------------------------------------------------
  // rows of SOUND.ROW into RD.out (see the header); the callbacks made once, nothing allocated, nothing written but `out`
  const RD = { out: null, n: 0, max: 0 };
  // (SEA0: the sea defaults, with the swimming above)
  function rdRow(one, kind) {
    if (RD.n >= RD.max) return;
    const o = RD.out, q = RD.n * 12, a = one.a, sz = one.size || 1, len = (a.length || 1) * sz;
    let x = one.x, y = one.y, z = one.z, vx = 0, vz = 0, vy = 0, st = 0, ev = -1;
    if (kind === 'sea') {
      // the blowhole: a third of the length forward of the pivot, at the surface while the back is out
      const S = a.sea || SEA0, d = one.dir, hl = Math.sqrt(d.x * d.x + d.z * d.z) || 1;
      x += d.x / hl * len * 0.33; z += d.z / hl * len * 0.33;
      y = one.wasUp ? one.y + one.depth + 0.2 : one.y;
      vx = d.x * S.speed; vy = d.y * S.speed; vz = d.z * S.speed;
      st = one.wasUp ? 2 : 3;
      ev = one.blowT;
    } else if (kind === 'air') {
      // the flock's track: its heading is the bird's dir (flockStep set it from F.hd)
      const F = one.F, sp = F ? F.speed : 0;
      vx = one.dir.x * sp; vz = one.dir.z * sp;
      st = 4;
    } else {
      // the head: forward of the pivot along the heading, near the top of the body
      const hgt = a.dim && a.dim[1] > 0 ? a.dim[1] : 1.2;
      x += one.dir.x * len * 0.42; z += one.dir.z * len * 0.42;   // (dir: the heading, landStep's own (sin hd, 0, cos hd))
      y = one.H.obj.position.y + hgt * sz * 0.8;
      st = one.state === 'walk' ? 1 : 0;
      ev = one.callT;
    }
    o[q] = one.sp; o[q + 1] = x; o[q + 2] = y; o[q + 3] = z; o[q + 4] = vx; o[q + 5] = vy; o[q + 6] = vz;
    o[q + 7] = st; o[q + 8] = ev; o[q + 9] = one.herd; o[q + 10] = one.H.obj.visible ? 1 : 0; o[q + 11] = len;
    RD.n++;
  }
  const rdHerd = h => { const ones = h.ones, k = h.kind; for (let i = 0; i < ones.length; i++) rdRow(ones[i], k); };
  function sound(out) {
    RD.out = out; RD.n = 0; RD.max = Math.floor(out.length / 12);
    HERDS.forEach(rdHerd);
    for (let f = 0; f < FLOCKS.length; f++) { const ones = FLOCKS[f].ones; for (let i = 0; i < ones.length; i++) rdRow(ones[i], 'air'); }
    RD.out = null;
    return RD.n;
  }

  function dispose() {
    if (WK) { WK.dispose(); WK = null; }
    if (typeof window !== 'undefined' && window.WATER && window.WATER.setSubmerged) window.WATER.setSubmerged(SUBK, null);
    for (const [, h] of HERDS) drop(h);
    HERDS.clear();
    for (const F of FLOCKS) for (const one of F.ones) one.H.dispose();
    FLOCKS.length = 0;
    if (root.parent) root.parent.remove(root);
  }

  return { root, sync, tick, ambient, dispose, stats, wakes: () => WK,
           sound, clock: () => T,                     // G1705 (SND-ANIMALS): the sound's read-only reader and the run's clock
           herds: () => Array.from(HERDS.keys()),
           // the probe the gate and the bench read: every individual, flat
           list: () => {
             const out = [];
             for (const [id, h] of HERDS) for (const one of h.ones)
               out.push({ id, key: one.a.key, kind: h.kind, i: one.i, x: one.x, y: one.H.obj.position.y,
                          z: one.z, hd: one.hd, state: one.state, depth: one.depth, size: +(one.size || 1).toFixed(3),
                          clip: one.H.clip() ? one.H.clip().key : null, shown: one.H.obj.visible,
                          // ANIMALS-MOTION (GATE ANIMOTION): the clip's role and rate, the yaw rate, on the spot or not
                          role: one.H.clip() ? one.H.clip().role : null, rate: one.H.player ? one.H.player.rate : 0,
                          w: one.w || 0, pivot: !!one.pivot,
                          from: one.H.player && one.H.player.prev ? one.H.player.prev.key : null,
                          fadeU: one.H.player && one.H.player.prev ? one.H.player.fadeT / Math.max(1e-6, one.H.player.fade) : 1,
                          ct: one.H.player ? one.H.player.t : 0 });
             for (const F of FLOCKS) for (const one of F.ones)
               out.push({ id: 'ambient', key: one.a.key, kind: 'air', i: one.i, x: one.x, y: one.y, z: one.z,
                          hd: F.hd, state: 'fly', depth: 0, clip: one.H.clip() ? one.H.clip().key : null, shown: true });
             return out;
           } };
};

if (typeof window !== 'undefined') window.ANIMAL_RUN = AR;
if (typeof module !== 'undefined' && module.exports) module.exports = AR;
})();
