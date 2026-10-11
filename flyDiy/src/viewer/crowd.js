// ============================================================
// THE CROWD (CHARACTERS G2970-G2989, the user 11 Oct: "animated passengers").
//
// Passengers come out of a point (the terminal, the hangar door, a stand),
// walk a polyline to the aeroplane's door, queue, turn to face the door and
// BOARD - a fade between two poses, standing at the door and seated in their
// seat (no climbing: the user's word). The seated pose is not this module's:
// it is the crew layer's occupant at that seat station, which the host hides
// at the start and hands to `seatFade` as the person fades out at the door.
// Out of scope by the user's ruling: a free-roaming pilot, NPC drivers.
//
// TWO HALVES, one file (lazy: build.js MANIFEST.lazy, FLYDIY_LAZY('crowd')):
//   THE RUN - plan + state machine, pure numbers, no THREE. GATE CHARS drives
//     it in node: queue spacing, nobody passes anybody, everyone boards, the
//     walker's fade and the seat's add to one through the whole board.
//   THE LOOK - make(THREE, ctx): the cast's manifests and the clips fetched
//     from src/chars/crowd_pack.json (media/, content-hashed, never in
//     index.html), a CAGE_CHAR instance per person posed from the shared
//     clips by joint name, the distance ladder, the dithered fade.
//
// THE CLIPS (tools/chars_table.py CROWD_CLIPS). Rotations on a uniform grid,
// one set for every character (Mixamo joint frames are shared). A walk carries
// `rootV`, its forward travel per second: the crowd moves the person by
// exactly that (feet do not skate) and `bob`, the Hips' height about its mean.
// Two clips blend over BLEND seconds when the state changes; nothing else.
//
// THE LADDER (the brief: "no skinning past roughly 60 m, and a cap on how many
// animate at once"). Under NEAR (60 m) a person's skeleton is posed from the
// clips; the CAP nearest every frame, the rest every third frame. Past NEAR
// the skeleton FREEZES - no clip sampling, the rig's matrices parked out of
// three's walk (animals.js's park) - and the person glides as one rigid body;
// past FAR (150 m) they are not drawn. The frozen copy is still a GPU skin at
// a fixed pose (no second program to compile mid-flight); the HANDOVER owes a
// baked static copy if a census says the frozen skins cost.
//
// THE FADE. A dithered dissolve, never `transparent` (G205.1: three sorts a
// skinned mesh by its armature origin - hair flipped through the glass). A
// FADE TWIN is a clone of a material whose own onBeforeCompile runs first and
// then discards a fragment whose screen hash is over uFade; its program key is
// 'crowdFade|' + the original's, so a twin never shares a program with
// another hook's twin (the cached-program uniforms trap, G1521). Walkers wear
// twins for life, with the cabin's darkness off (uInside 0: they are outside);
// a seated figure wears twins only while it fades in, then its own again.
// ============================================================
'use strict';
(function (root) {
const CR = {};

// ---- tunables -------------------------------------------------------------
const DEF = {
  spacing: 0.9,     // m between two people in the queue (and while walking)
  speed: 1.3,       // m/s when the walk clip has no travel of its own
  gap: 1.6,         // s between two people leaving the start point
  turnRate: 4.0,    // rad/s the walking heading follows the path's
  turnT: 0.7,       // s to turn from the path to face the door
  boardT: 1.2,      // s of the fade (standing at the door -> seated)
  blend: 0.3,       // s a clip change blends over
  near: 60,         // m: the skeleton is posed under this
  far: 150,         // m: nobody is drawn past this
  cap: 4,           // the nearest this many animate every frame
};
CR.DEF = DEF;

// ---- THE RUN: a polyline --------------------------------------------------
// pts [[x, z], ...] -> { pts, cum, L }: cumulative arc length
function poly(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] };
}
// the point and the heading (yaw: 0 faces +z, the Mixamo character's front)
// at arc length s, clamped to the line
function at(P, s, out) {
  const o = out || {};
  const n = P.pts.length;
  if (n === 1) { o.x = P.pts[0][0]; o.z = P.pts[0][1]; o.yaw = 0; return o; }
  s = Math.max(0, Math.min(P.L, s));
  let i = 1;
  while (i < n - 1 && P.cum[i] < s) i++;
  const a = P.pts[i - 1], b = P.pts[i], seg = P.cum[i] - P.cum[i - 1];
  const u = seg > 1e-9 ? (s - P.cum[i - 1]) / seg : 1;
  o.x = a[0] + (b[0] - a[0]) * u;
  o.z = a[1] + (b[1] - a[1]) * u;
  o.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return o;
}
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
CR.poly = poly; CR.at = at;

// THE PLAN: the queue's slots on the polyline. Slot r (r people ahead still
// standing) is r * spacing back from the door's foot along the path - so the
// queue bends with the path, and a path shorter than the queue starts people
// at slot positions clamped to its start.
function slotS(P, r, spacing) { return Math.max(0, P.L - r * spacing); }
CR.slotS = slotS;

// THE ROUTE (pure; the host hands the aeroplane's ground frame): from a start
// point to the cabin door's foot, the queue's last leg square to the fuselage.
//   door [x, z]  the foot of the door (beside the cabin, on the ground)
//   out  [x, z]  unit, away from the fuselage at the door
//   fwd  [x, z]  unit, the aeroplane's nose
//   from [x, z]  where they come from (the hangar's door, a terminal)
//   n, spacing   the queue's length; tailBack: the door to behind the tail (m)
// -> { path: [[x, z]...], face }. A start AFT of the door passes behind the
// tail on the door's side; one FORWARD of it swings wide of the propeller and
// the wing first; one on the FAR side walks aft along its own side and crosses
// behind the tail. Never through the aeroplane, always in at the queue's end.
function route(o) {
  const sp = o.spacing || DEF.spacing, n = Math.max(1, o.n | 0);
  const qLen = n * sp + 1.5, wide = o.wide || 8, tailBack = o.tailBack || 8;
  const [dx, dz] = o.door, [ox, oz] = o.out, [fx, fz] = o.fwd, [sx, sz] = o.from;
  const P = (a, b) => [dx + ox * a + fx * b, dz + oz * a + fz * b];   // a out, b forward of the door
  const rx = sx - dx, rz = sz - dz, along = rx * fx + rz * fz, side = rx * ox + rz * oz;
  const pts = [[sx, sz]];
  if (side < 0) {
    // the far side (inboard of the door's line): aft along it 3 m clear of the fuselage, behind the tail, round
    const lane = Math.min(side, -(o.half || 1.3) - 3);
    pts.push(P(lane, Math.min(along, -tailBack)), P(3, -tailBack), P(qLen, -tailBack));
  } else if (along < 0) {
    // aft: round the tail on the door's side unless already out beyond the queue
    if (side < qLen) pts.push(P(Math.max(side, 3), -tailBack), P(qLen, -tailBack));
  } else {
    // forward: out wide first (the propeller's disc and the wing's tip), then back along the queue's line
    pts.push(P(Math.max(side, wide), along), P(Math.max(qLen, wide), 0));
  }
  pts.push(P(qLen, 0), [dx, dz]);
  // drop the degenerate legs (a start already on the queue's line)
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1];
    if (Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) > 0.05) out.push(pts[i]);
  }
  return { path: out, face: Math.atan2(-ox, -oz) };
}
CR.route = route;

// ---- THE RUN: the state machine ------------------------------------------
// spec = { path: [[x,z]...] start -> the door's foot, face: yaw to board,
//          seats: [{ seat, key, pose? }] in boarding order,
//          spacing?, speed?, gap?, queueClips?: n (how many queue clips to alternate) }
// people[i] = { seat, key, state, s, x, z, yaw, clip: {a, ta, b, tb, w}, stand, seatW, bob }
//   state: 'wait' (not out yet) | 'walk' | 'queue' | 'turn' | 'board' | 'seated'
//   stand: the walker's fade (1 drawn, 0 gone); seatW: the seated figure's (0 -> 1)
const CLIP = { walk: 'walk', idle: 'idle', queue: 'queue' };
function run(spec, clipInfo) {
  const o = Object.assign({}, DEF, spec);
  const P = poly(spec.path && spec.path.length ? spec.path : [[0, 0]]);
  const ci = clipInfo || {};
  const v = ci.rootV > 0.3 ? ci.rootV : o.speed;          // a walk 'in place' moves at the default
  const nQ = Math.max(1, ci.queueClips | 0 || o.queueClips | 0 || 1);
  const face = spec.face != null ? spec.face : at(P, P.L).yaw;
  const people = (spec.seats || []).map((s, i) => ({
    i, seat: s.seat, key: s.key, pose: s.pose || null,
    state: 'wait', s: 0, x: P.pts[0][0], z: P.pts[0][1], yaw: at(P, 0).yaw,
    clip: { a: CLIP.idle, ta: 0, b: null, tb: 0, w: 0 },
    queueClip: i % nQ, stand: 0, seatW: 0, bob: 0, tState: 0, walkT: 0, yaw0: 0,
  }));
  const R = { P, v, face, people, T: 0, spec: o, boarded: [] };
  const pt = {};
  function setClip(p, name) {
    const c = p.clip;
    if ((c.b || c.a) === name) return;
    // the incoming clip becomes b and blends in; a blend cut short starts from where it was
    if (c.b) { c.a = c.b; c.ta = c.tb; }
    c.b = name; c.tb = 0; c.w = 0;
  }
  function stepClip(p, dt, rate) {
    const c = p.clip;
    c.ta += dt * (c.a === CLIP.walk ? rate : 1);
    if (c.b) {
      c.tb += dt * (c.b === CLIP.walk ? rate : 1);
      c.w = Math.min(1, c.w + dt / o.blend);
      if (c.w >= 1) { c.a = c.b; c.ta = c.tb; c.b = null; c.w = 0; }
    }
  }
  R.step = function (dt) {
    if (!(dt > 0)) return R;
    R.T += dt;
    let rank = 0, ahead = null;
    for (const p of people) {
      if (p.state === 'seated') continue;
      const r = rank++;
      if (p.state === 'wait') {
        // out of the start point on its turn, once the one ahead is out and a spacing clear of it
        if (R.T >= p.i * o.gap && (!ahead || (ahead.state !== 'wait' && ahead.s >= o.spacing - 1e-6))) {
          p.state = 'walk'; p.stand = 1; p.tState = 0;
        } else { ahead = p; continue; }
      }
      p.tState += dt;
      if (p.state === 'walk' || p.state === 'queue') {
        // the slot of this rank, never closer than `spacing` to the one ahead
        let target = slotS(P, r, o.spacing);
        if (ahead && ahead.state !== 'wait') target = Math.min(target, ahead.s - o.spacing);
        target = Math.max(0, target);
        const go = target - p.s;
        if (go > 0.02) {
          const ds = Math.min(v * dt, go);
          p.s += ds;
          if (p.state !== 'walk') { p.state = 'walk'; p.tState = 0; }
          setClip(p, CLIP.walk);
          stepClip(p, dt, ds / (v * dt));
          p.walkT = p.clip.a === CLIP.walk ? p.clip.ta : p.clip.tb;
        } else {
          if (go > 0) p.s = target;
          if (r === 0 && p.s >= P.L - 0.02) { p.state = 'turn'; p.tState = 0; p.yaw0 = p.yaw; setClip(p, CLIP.idle); }
          else { if (p.state !== 'queue') { p.state = 'queue'; p.tState = 0; } setClip(p, CLIP.queue); }
          stepClip(p, dt, 1);
        }
        at(P, p.s, pt);
        p.x = pt.x; p.z = pt.z;
        // the heading follows the path's at turnRate (a corner is a turn, not a snap)
        const d = wrap(pt.yaw - p.yaw), mx = o.turnRate * dt;
        p.yaw = wrap(p.yaw + Math.max(-mx, Math.min(mx, d)));
      } else if (p.state === 'turn') {
        const u = smooth(p.tState / o.turnT);
        p.yaw = wrap(p.yaw0 + wrap(face - p.yaw0) * u);
        stepClip(p, dt, 1);
        if (p.tState >= o.turnT) { p.yaw = face; p.state = 'board'; p.tState = 0; }
      } else if (p.state === 'board') {
        // ONE CROSSFADE: what leaves the door is what arrives in the seat
        const u = smooth(p.tState / o.boardT);
        p.stand = 1 - u; p.seatW = u;
        stepClip(p, dt, 1);
        if (p.tState >= o.boardT) { p.stand = 0; p.seatW = 1; p.state = 'seated'; R.boarded.push(p.seat); }
      }
      // the Hips' bob rides only while walking (weight of the walk clip in the blend)
      const c = p.clip, wWalk = c.b ? (c.a === CLIP.walk ? 1 - c.w : 0) + (c.b === CLIP.walk ? c.w : 0) : (c.a === CLIP.walk ? 1 : 0);
      p.bob = wWalk && ci.bob ? wWalk * ci.bob(p.walkT) : 0;
      ahead = p;
    }
    return R;
  };
  R.done = () => people.every(p => p.state === 'seated');
  return R;
}
CR.run = run;

// ---- THE CLIP SAMPLER (pure: Float32Array quats) ---------------------------
// a = the clip's manifest (fps, frames, dur, joints), dec its frames; writes
// the joint's local rotation at t (wrapped) into out[o..o+3] (nlerp: the
// frames are 1/15 - 1/30 s apart)
function sampleQ(a, dec, ji, t, out, o) {
  const nj = a.joints.length;
  let f = ((t % a.dur) + a.dur) % a.dur * a.fps;
  const f0 = Math.min(a.frames - 1, Math.floor(f)), f1 = Math.min(f0 + 1, a.frames - 1), u = f - f0;
  const p = (f0 * nj + ji) * 4, q = (f1 * nj + ji) * 4;
  let d = dec[p] * dec[q] + dec[p + 1] * dec[q + 1] + dec[p + 2] * dec[q + 2] + dec[p + 3] * dec[q + 3];
  const sg = d < 0 ? -1 : 1;
  let x = dec[p] + (sg * dec[q] - dec[p]) * u, y = dec[p + 1] + (sg * dec[q + 1] - dec[p + 1]) * u,
      z = dec[p + 2] + (sg * dec[q + 2] - dec[p + 2]) * u, w = dec[p + 3] + (sg * dec[q + 3] - dec[p + 3]) * u;
  d = Math.hypot(x, y, z, w) || 1;
  out[o] = x / d; out[o + 1] = y / d; out[o + 2] = z / d; out[o + 3] = w / d;
  return out;
}
CR.sampleQ = sampleQ;
// the walk's bob at t (m), linear between frames
function bobAt(a, t) {
  if (!a || !a.bob || !a.bob.length) return 0;
  const f = ((t % a.dur) + a.dur) % a.dur * a.fps, f0 = Math.min(a.bob.length - 1, Math.floor(f)),
        f1 = Math.min(f0 + 1, a.bob.length - 1), u = f - f0;
  return a.bob[f0] + (a.bob[f1] - a.bob[f0]) * u;
}
CR.bobAt = bobAt;

// ---- THE PACK (the page: fetched once) ------------------------------------
const W = typeof window !== 'undefined' ? window : null;
const base = () => (W && W.FLYDIY_ASSET_BASE) || '';
let PACK = null;
function pack() {
  if (PACK) return PACK;
  if (!W || typeof fetch !== 'function') return Promise.reject(new Error('crowd: no page'));
  return (PACK = fetch(base() + 'src/chars/crowd_pack.json').then(r => (r.ok ? r.json() : Promise.reject(new Error('crowd_pack ' + r.status))))
    .catch(e => { PACK = null; throw e; }));
}
CR.pack = pack;
// a cast member: registered into CHAR_REG.chars WITHOUT CHAR_REG.order (the
// editor's select and the crew's passenger cycle never list them), its budget
// row into CHAR_KTX2_TABLE before any material of it is made
const CAST_P = {};
function castLoad(P, key) {
  const REG = typeof CHAR_REG !== 'undefined' ? CHAR_REG : null;
  if (!REG) return Promise.reject(new Error('crowd: no CHAR_REG'));
  if (REG.chars[key]) return Promise.resolve(REG.chars[key]);
  const row = (P.cast || []).find(c => c.key === key);
  if (!row || !row.man) return Promise.reject(new Error('crowd: no cast member ' + key));
  if (CAST_P[key]) return CAST_P[key];
  const B = base();
  return (CAST_P[key] = W.ASSET_FETCH(B + row.man).then(u8 => {
    const c = JSON.parse(new TextDecoder().decode(u8));
    c.bin = B + c.bin;
    for (const k in c.texs) if (typeof c.texs[k] === 'string') c.texs[k] = B + c.texs[k];
    if (typeof CHAR_KTX2_TABLE !== 'undefined' && P.ktx2 && P.ktx2[key]) CHAR_KTX2_TABLE[key] = P.ktx2[key];
    REG.chars[key] = c;
    return c;
  }).catch(e => { delete CAST_P[key]; throw e; }));
}
// THE CAST, READY TO SEAT (the host, under the roll-out screen): the pack and every member's MANIFEST (no bins, no
// maps) - so the crew layer can rig a job's passenger as a cast member before the flown model is dressed.
// -> Promise of the cast's keys in table order (CR.castKeys() the same, once settled)
let KEYS = [];
CR.prepare = () => pack().then(P => Promise.all((P.cast || []).map(c => castLoad(P, c.key).then(() => c.key, () => null))))
  .then(ks => (KEYS = ks.filter(Boolean)));
CR.castKeys = () => KEYS.slice();
// the clips, the same way: CHAR_ANIMS.anims without the order
function clipsRegister(P) {
  const A = typeof CHAR_ANIMS !== 'undefined' ? CHAR_ANIMS : null;
  if (!A) return;
  const B = base();
  for (const k in P.clips || {}) if (!A.anims[k]) A.anims[k] = Object.assign({}, P.clips[k], { bin: B + P.clips[k].bin });
}

// ---- THE FADE TWIN ---------------------------------------------------------
const FADE_FS = 'uniform float uFade;\n' +
  'float crowdIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\n';
function fadeTwin(THREE, m, inside) {
  const t = m.clone();
  // clone() deep-copies userData through JSON (a uniform's Vector2 becomes a
  // plain object) and leaves the hook behind: both put back by reference
  t.userData = Object.assign({}, m.userData);
  if (inside != null && m.userData.aeroU) {
    t.userData.aeroU = Object.assign({}, m.userData.aeroU, { uInside: { value: new THREE.Vector2(+inside, 0) } });
    t.userData.aeroInside = +inside;
  }
  const own = m.onBeforeCompile, key0 = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  const uFade = { value: 1 };
  t.userData.crowdFade = uFade;
  t.onBeforeCompile = function (shader, r) {
    if (own) own.call(this, shader, r);
    shader.uniforms.uFade = uFade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FADE_FS + '#include <common>')
      .replace('#include <clipping_planes_fragment>',
               '#include <clipping_planes_fragment>\n  if (uFade < 0.999 && crowdIgn(gl_FragCoord.xy) >= uFade) discard;');
  };
  t.customProgramCacheKey = () => 'crowdFade|' + key0 + '|' + (own ? own.toString().length : 0);
  t.needsUpdate = true;
  return t;
}
CR.fadeTwin = fadeTwin;
// a seated figure's meshes, faded: w <= 0 hidden, 0 < w < 1 on twins, w >= 1
// back on their own materials (the twins kept for the next boarding)
function fadeObjects(THREE, meshes, w) {
  for (const m of meshes) {
    if (!m || !m.material) continue;
    const u = m.userData;
    if (!u.crowdOwn) u.crowdOwn = m.material;
    if (w <= 0) { m.visible = false; continue; }
    m.visible = true;
    if (w >= 1) { m.material = u.crowdOwn; continue; }
    const own = u.crowdOwn;
    if (!own.userData.crowdTwin) own.userData.crowdTwin = fadeTwin(THREE, own);
    m.material = own.userData.crowdTwin;
    m.material.userData.crowdFade.value = w;
  }
}
CR.fadeObjects = fadeObjects;

// ---- THE LOOK: make(THREE, ctx) --------------------------------------------
// ctx.scene             the Object3D the walkers stand in (world coordinates)
// ctx.ground(x, z)      -> terrain height (required)
// ctx.eye()             -> {x, y, z} the camera (the ladder); optional
// ctx.seatFade(seat, w) the host's seated figure: 0 hidden ... 1 its own self
// ctx.done(seat)        optional: a person has boarded
function make(THREE, ctx) {
  const CC = W && W.CAGE_CHAR;
  const M = { people: [], stats: { shown: 0, posed: 0, frozen: 0, boarding: 0 }, runs: [] };
  const QA = new Float32Array(4), QB = new Float32Array(4);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const MATS = new Map();   // char material -> its walker twin
  let frame = 0;
  const walkerMat = m => { let t = MATS.get(m); if (!t) { t = fadeTwin(THREE, m, 0); MATS.set(m, t); } return t; };
  // the joint map of (character, clip): clip joint i -> the instance's object
  const JM = new Map();
  function jmap(inst, a) {
    const k = inst.key + '|' + a.key;
    let m = JM.get(k);
    if (!m) { const R = inst.rig; m = a.joints.map(n => (R.byBase[n] != null ? R.byBase[n] : -1)); JM.set(k, m); }
    return m;
  }
  function pose(H, p, clips) {
    const c = p.clip, A = clips[c.a], Bc = c.b ? clips[c.b] : null;
    if (!A || !A.dec) return false;
    const objs = H.inst.tree.objs, ma = jmap(H.inst, A.a);
    if (!Bc || !Bc.dec) {
      for (let j = 0; j < ma.length; j++) if (ma[j] >= 0) { sampleQ(A.a, A.dec, j, c.ta, QA, 0); objs[ma[j]].quaternion.fromArray(QA); }
    } else {
      // the blend: both clips sampled on the union of their joints
      const mb = jmap(H.inst, Bc.a);
      for (let j = 0; j < ma.length; j++) if (ma[j] >= 0) { sampleQ(A.a, A.dec, j, c.ta, QA, 0); objs[ma[j]].quaternion.fromArray(QA); }
      for (let j = 0; j < mb.length; j++) if (mb[j] >= 0) {
        sampleQ(Bc.a, Bc.dec, j, c.tb, QB, 0);
        qa.copy(objs[mb[j]].quaternion); qb.fromArray(QB);
        objs[mb[j]].quaternion.copy(qa.slerp(qb, c.w));
      }
    }
    return true;
  }
  // THE RIG'S MATRIX WALK (animals.js's park, three-way): 2 posed (every joint composes), 1 gliding (the joints'
  // locals are frozen, their world matrices follow the moving group - the skin reads bone.matrixWorld), 0 still or
  // hidden (nothing walks; the last world matrices stand). Entering 0 composes once first.
  const park = (h, mode) => {
    if (h.mode === mode) return;
    if (mode === 0) h.g.updateMatrixWorld(true);
    h.mode = mode;
    h.inst.tree.root.traverse(o => { o.matrixAutoUpdate = mode === 2; o.matrixWorldAutoUpdate = mode >= 1; });
  };
  // board(spec): spec = { path, face, seats: [{seat, key}] } (the run's) -> Promise of the run
  M.board = function (spec) {
    return pack().then(P => {
      clipsRegister(P);
      const roles = P.roles || {};
      const want = { walk: (roles.walk || [])[0], idle: (roles.idle || [])[0], queue: (roles.queue || []).slice() };
      const castKeys = (P.cast || []).map(c => c.key);
      // a seat whose figure has no character takes the cast in order
      const seats = (spec.seats || []).map((s, i) => Object.assign({}, s, { key: s.key || castKeys[i % Math.max(1, castKeys.length)] }));
      const keys = [...new Set(seats.map(s => s.key).filter(Boolean))];
      const clipKeys = [want.walk, want.idle, ...want.queue].filter(Boolean);
      return Promise.all([
        Promise.all(keys.map(k => castLoad(P, k).then(() => CC.load(k)))),
        Promise.all(clipKeys.map(k => CC.animLoad(k))),
      ]).then(([, decs]) => {
        const clips = {};
        const A = typeof CHAR_ANIMS !== 'undefined' ? CHAR_ANIMS.anims : {};
        clipKeys.forEach((k, i) => { clips[k] = { a: A[k], dec: decs[i] }; });
        const walkA = A[want.walk];
        const R = run(Object.assign({}, spec, { seats }), {
          rootV: walkA && walkA.rootV, queueClips: want.queue.length,
          bob: walkA && walkA.bob ? t => bobAt(walkA, t) : null,
        });
        // the run's clip names -> this pack's clip keys (a person's queue clip by index)
        const name = (p, n) => (n === 'walk' ? want.walk : n === 'idle' ? want.idle : want.queue[p.queueClip] || want.idle);
        const H = R.people.map(p => {
          const inst = CC.instance(p.key);
          if (!inst) return null;
          for (const sm of inst.meshes) sm.material = walkerMat(sm.material);
          const g = new THREE.Group();
          g.name = 'crowd:' + p.key + ':' + p.seat;
          // the feet on the ground: the rig's lowest joint at rest
          let yMin = Infinity;
          inst.tree.root.updateMatrixWorld(true);
          const v = new THREE.Vector3();
          for (const o of inst.tree.objs) if (o.isBone) { o.getWorldPosition(v); if (v.y < yMin) yMin = v.y; }
          inst.tree.root.position.y = -(isFinite(yMin) ? yMin : 0);
          g.add(inst.tree.root);
          g.visible = false;
          ctx.scene.add(g);
          if (ctx.seatFade) ctx.seatFade(p.seat, 0);
          return { inst, g, p, fade: inst.meshes.map(sm => sm.material) };
        });
        const one = { R, H, clips, name, seen: new Set(), ready: !ctx.compile };
        M.runs.push(one);
        // THE PROGRAMS BEFORE THE FIRST DRAW: the walkers' twins compiled off the frame (renderer.compileAsync), the
        // group drawn once they are - a person appears a moment late rather than a frame arriving late
        // (three's compile walks VISIBLE objects, synchronously, before its promise: shown for the call, hidden after)
        if (ctx.compile) {
          const gs = H.filter(Boolean).map(h => h.g);
          for (const g of gs) g.visible = true;
          let pr = null;
          try { pr = ctx.compile(gs); } catch (e) {}
          for (const g of gs) g.visible = false;
          Promise.resolve(pr).catch(() => {}).then(() => { one.ready = true; });
        }
        return R;
      });
    });
  };
  const view = { a: null, b: null };
  function clipView(one, p) {
    // the run speaks roles; the pose wants this pack's clip keys
    const c = p.clip;
    view.a = one.name(p, c.a); view.b = c.b ? one.name(p, c.b) : null;
    return view;
  }
  M.tick = function (dt) {
    frame++;
    const e = ctx.eye ? ctx.eye() : null;
    const S = M.stats;
    S.shown = S.posed = S.frozen = S.boarding = 0;
    for (const one of M.runs) {
      one.R.step(dt);
      // the ladder: distances first, then the CAP nearest pose every frame
      const order = [];
      for (const h of one.H) {
        if (!h) continue;
        const p = h.p;
        const d = e ? Math.hypot(p.x - e.x, p.z - e.z) : 0;
        h.d = d;
        const out = p.state === 'wait' || p.state === 'seated';
        const on = !out && one.ready && d < DEF.far;
        h.g.visible = on;
        if (p.state === 'seated' && !one.seen.has(p.seat)) {
          one.seen.add(p.seat);
          if (ctx.seatFade) ctx.seatFade(p.seat, 1);
          if (ctx.done) ctx.done(p.seat);
        }
        if (!on) { park(h, 0); continue; }
        S.shown++;
        h.g.position.set(p.x, ctx.ground(p.x, p.z) + p.bob, p.z);
        h.g.rotation.set(0, p.yaw, 0);
        if (p.state === 'board') {
          S.boarding++;
          for (const sm of h.inst.meshes) sm.material.userData.crowdFade.value = p.stand;
          if (ctx.seatFade) ctx.seatFade(p.seat, p.seatW);
        }
        if (d < DEF.near) order.push(h);
        else { park(h, p.state === 'walk' ? 1 : 0); for (const sm of h.inst.meshes) sm.castShadow = false; S.frozen++; }
      }
      order.sort((a, b) => a.d - b.d);
      order.forEach((h, k) => {
        park(h, 2);
        // a shadow for the CAP nearest only (the depth pass of a 50k-triangle skin is not free)
        for (const sm of h.inst.meshes) sm.castShadow = k < DEF.cap;
        if (k >= DEF.cap && (frame + h.p.i) % 3) return;
        // the walker's material carries its own fade; reset after a board
        if (h.p.state !== 'board') for (const sm of h.inst.meshes) sm.material.userData.crowdFade.value = 1;
        const cv = clipView(one, h.p);
        const c = h.p.clip;
        pose(h, { clip: { a: cv.a, ta: c.ta, b: cv.b, tb: c.tb, w: c.w } }, one.clips);
        S.posed++;
      });
    }
    // a run whose everyone boarded is put away
    for (let i = M.runs.length - 1; i >= 0; i--) if (M.runs[i].R.done()) { drop(M.runs[i]); M.runs.splice(i, 1); }
    return S.shown;
  };
  function drop(one) {
    for (const h of one.H) if (h) { if (h.g.parent) h.g.parent.remove(h.g); }
  }
  M.clear = function () {
    for (const one of M.runs) {
      // whoever had not boarded yet is seated now (the host's figure back on)
      for (const h of one.H) if (h && h.p.state !== 'seated' && ctx.seatFade) ctx.seatFade(h.p.seat, 1);
      drop(one);
    }
    M.runs.length = 0;
  };
  M.busy = () => M.runs.length > 0;
  return M;
}
CR.make = make;

if (typeof module !== 'undefined' && module.exports) module.exports = CR;
else root.CROWD = CR;
})(typeof window !== 'undefined' ? window : this);
