// ============================================================
// THE ANIMALS — one factory that turns a baked animal into a posable three.js
// instance, one clip player that chains the delivered clips, and one ladder
// that swaps the skinned mesh for a static level at distance.
//
// The payloads are built by tools/animal_prep.py from the declared table in
// tools/animals_table.py and decoded by src/core/55_animal_codec.js; the
// static levels are a PROP pack (tools/animal_lod.js) and come through
// props.js's own factory. This file is the only place that knows three.js.
// The BEHAVIOURS — what a bear does with the clips, where a whale swims — are
// animal_run.js; this file knows nothing about herds, terrain or water.
//
// THE ONE MATERIAL. An animal lands on the prop library's recipe, through
// props.js's `propMaterial` itself: map / arm (R ao, G rough, B metal) /
// normal, one MeshStandardMaterial. That is not a convenience — it is what
// makes "the LODs need a similar volume and color" true by construction,
// because the level and the animal are then the same record on the same
// factory wearing the same three images. The animal's texture table is copied
// into PROP_REG.texs at first build so the recipe finds them whether or not
// the levels pack was loaded.
//
// THE CLIP PLAYER. A clip is frames of TRS on a uniform grid over the nodes
// it actually animates (55_animal_codec). Playing one is: find the two frames
// either side of t, write the lerped TRS onto the node objects, and hand back
// how far the root travelled (the baker took the root's walk out of the frames
// so the WORLD moves the animal — the feet then do not skate). Two clips can
// play at once: `play(role, {fade})` keeps the outgoing one and blends TRS to
// the incoming over `fade` seconds. Nothing else is ever blended — no masks,
// no layers, no additive tracks. The user's ruling, 2026-09-22: "just do
// animations chaining clips ... take no risk".
//
// THE LADDER. `place()` returns a THREE.LOD whose level 0 is the skinned
// instance and whose other levels are the cut props, each hung at -pivot so
// the swap does not jump. The skeleton is only written when level 0 is the
// visible one, so a herd at 300 m costs a clock each and nothing more.
//
// THE LOOM (the sea animals). The water is drawn transparent but its opacity
// is the COLUMN's — deep water is opaque and a submerged whale simply is not
// there. So a submerged sea animal draws a second, unlit copy of its first
// level AFTER the water with the depth test off, tinted by the water it is
// under and fading out over a few body depths: a shape that rises out of the
// green and becomes an animal. `loomSet(depth)` per frame is the whole of it.
// ============================================================
'use strict';
(function () {
const A = {};
const REG = () => (typeof ANIMAL_REG !== 'undefined' ? ANIMAL_REG : { animals: {}, order: [] });

const BINS = new Map();          // key -> { geo: Uint8Array, clip: Uint8Array }
const WARMS = new Map();         // key -> Promise
const BUILT = new Map();         // key -> { a, dec, clips, geos, mats, loomMats }

function reg(key) { return REG().animals[key]; }
function list(kind) { return REG().order.map(k => REG().animals[k]).filter(a => a && (!kind || a.kind === kind)); }

// ---- the bytes ------------------------------------------------------------
function ready(key) { return BUILT.has(key) || BINS.has(key); }
function warm(key) {
  const a = reg(key);
  if (!a) return Promise.reject(new Error('unknown animal: ' + key));
  if (ready(key)) return Promise.resolve();
  let w = WARMS.get(key);
  if (!w) {
    if (typeof window === 'undefined' || typeof window.ASSET_FETCH !== 'function')
      return Promise.reject(new Error('animal ' + key + ': no ASSET_FETCH here'));
    w = Promise.all([window.ASSET_FETCH(a.bin), window.ASSET_FETCH(a.clipBin)])
      .then(([geo, clip]) => { BINS.set(key, { geo, clip }); });
    WARMS.set(key, w);
  }
  return w;
}

// ---- the build (geometry and materials, ONCE per key) ---------------------
function build(THREE, key) {
  let b = BUILT.get(key);
  if (b) return b;
  const a = reg(key);
  if (!a) throw new Error('unknown animal: ' + key);
  const bin = BINS.get(key);
  if (!bin) throw new Error('animal ' + key + ': warm it first');
  const dec = decodeAnimal(a, bin.geo);
  const clips = decodeAnimalClips(a, bin.clip);
  // the maps into the prop registry, so propMaterial finds them whether or
  // not src/animals/animals_lods.js was loaded (the bird has none at all)
  if (typeof PROP_REG !== 'undefined') for (const id in a.texs) if (!PROP_REG.texs[id]) PROP_REG.texs[id] = a.texs[id];
  const geos = dec.meshes.map(m => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
    const uv = new THREE.BufferAttribute(m.uv, 2);
    g.setAttribute('uv', uv);
    g.setAttribute('uv1', uv);                 // aoMap reads the second set (props.js's note)
    if (m.skin) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(m.jt), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(m.wt, 4));
    }
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeBoundingSphere();
    return g;
  });
  const mats = a.mats.map(rec => {
    const m = propMaterial(THREE, rec);
    m.name = 'animal:' + key + ':' + (rec.name || '');
    m.userData.animalKey = key;
    return m;
  });
  b = { a, dec, clips, geos, mats, loom: null };
  BUILT.set(key, b);
  BINS.delete(key);                            // the decoded arrays are the keeper now
  return b;
}

// the LOOM materials, made on demand (only the sea animals ever ask): the
// animal's own colour map, unlit, drawn over the water
function loomMats(THREE, b) {
  if (b.loom) return b.loom;
  b.loom = b.a.mats.map(rec => {
    const o = { color: new THREE.Color(rec.col[0], rec.col[1], rec.col[2]),
                transparent: true, opacity: 0, depthTest: false, depthWrite: false,
                side: rec.dbl ? THREE.DoubleSide : THREE.FrontSide, toneMapped: true, fog: false };
    if (rec.map && typeof propTexture === 'function') o.map = propTexture(THREE, rec.map, true);
    const m = new THREE.MeshBasicMaterial(o);
    m.name = 'animalLoom:' + b.a.key;
    return m;
  });
  return b.loom;
}

// ---- an INSTANCE: a posable copy ------------------------------------------
// geometry and materials are shared across instances (a pod of three orcas is
// one upload); the node tree, the skeleton and the skinned meshes are per
// instance, because posing is what an instance is for.
function instance(THREE, key) {
  const b = build(THREE, key), a = b.a;
  const isJoint = new Set(a.joints);
  const objs = a.nodes.map((n, i) => {
    const o = isJoint.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.n;
    o.position.fromArray(n.t);
    o.quaternion.fromArray(n.r);
    o.scale.fromArray(n.s);
    return o;
  });
  a.nodes.forEach((n, i) => { if (n.p >= 0) objs[n.p].add(objs[i]); });
  const root = new THREE.Group();
  root.name = 'animal:' + key;
  root.scale.setScalar(a.scale);               // the delivered units -> the declared length
  for (const i of a.scene) root.add(objs[i]);
  root.updateMatrixWorld(true);
  const bones = a.joints.map(i => objs[i]);
  const inv = [];
  for (let i = 0; i < bones.length; i++) inv.push(new THREE.Matrix4().fromArray(b.dec.ibm, 16 * i));
  const skeleton = new THREE.Skeleton(bones, inv);
  const meshes = b.dec.meshes.map((m, i) => {
    let o;
    if (m.skin) {
      o = new THREE.SkinnedMesh(b.geos[i], b.mats[m.mat]);
      // BIND WITH THE IDENTITY, NOT THE NODE'S WORLD MATRIX (the character
      // layer's lesson, G204): glTF says the skinned mesh node's transform is
      // ignored — the vertices are in the skin's space and the inverse bind
      // matrices already carry the armature. Binding with matrixWorld applies
      // it twice and the animal collapses to a smear at the rig's origin.
      objs[m.node].add(o);
      o.bind(skeleton, new THREE.Matrix4());
      o.frustumCulled = false;                 // the bounding sphere is the rest pose's
    } else {
      // a rigid child (the elk's antlers): a plain mesh on its own node
      o = new THREE.Mesh(b.geos[i], b.mats[m.mat]);
      objs[m.node].add(o);
    }
    o.name = 'animal:' + key + ':' + m.name;
    o.castShadow = true;
    o.receiveShadow = true;
    o.userData.sharedGeo = true;               // propBuild's contract: never dispose these
    o.raycast = () => {};                      // a skinned raycast is against the BIND pose
    return o;
  });
  return { key, a, b, root, objs, bones, skeleton, meshes, clips: b.clips };
}

// ---- THE CLIP PLAYER ------------------------------------------------------
// state: { cur, t, rate, loop, prev, prevT, fade, fadeT, done }
function makePlayer(inst) {
  const a = inst.a, N = a.nodes.length;
  const rT = new Float32Array(N * 3), rR = new Float32Array(N * 4), rS = new Float32Array(N * 3);
  a.nodes.forEach((n, i) => {
    rT[i * 3] = n.t[0]; rT[i * 3 + 1] = n.t[1]; rT[i * 3 + 2] = n.t[2];
    rR[i * 4] = n.r[0]; rR[i * 4 + 1] = n.r[1]; rR[i * 4 + 2] = n.r[2]; rR[i * 4 + 3] = n.r[3];
    rS[i * 3] = n.s[0]; rS[i * 3 + 1] = n.s[1]; rS[i * 3 + 2] = n.s[2];
  });
  const T = [new Float32Array(N * 3), new Float32Array(N * 3)];
  const R = [new Float32Array(N * 4), new Float32Array(N * 4)];
  const S = [new Float32Array(N * 3), new Float32Array(N * 3)];
  const TR = [new Float32Array(3), new Float32Array(3)];

  // one clip at t seconds into slot k; also its root travel at that instant
  function sampleInto(c, t, k) {
    T[k].set(rT); R[k].set(rR); S[k].set(rS);
    const f = Math.max(0, Math.min(c.frames - 1, t * c.fps));
    const f0 = Math.floor(f), f1 = Math.min(c.frames - 1, f0 + 1), u = f - f0;
    const d = c.data, s = c.stride;
    let o0 = f0 * s, o1 = f1 * s;
    for (const nd of c.nt) {
      for (let j = 0; j < 3; j++) T[k][nd * 3 + j] = d[o0 + j] + (d[o1 + j] - d[o0 + j]) * u;
      o0 += 3; o1 += 3;
    }
    for (const nd of c.nr) {
      // nlerp, the shorter arc: at 10-24 fps the step is a few degrees and
      // the difference from a slerp is under a tenth of one
      let dot = 0;
      for (let j = 0; j < 4; j++) dot += d[o0 + j] * d[o1 + j];
      const sgn = dot < 0 ? -1 : 1;
      let n2 = 0;
      for (let j = 0; j < 4; j++) { const v = d[o0 + j] + (sgn * d[o1 + j] - d[o0 + j]) * u; R[k][nd * 4 + j] = v; n2 += v * v; }
      n2 = Math.sqrt(n2) || 1;
      for (let j = 0; j < 4; j++) R[k][nd * 4 + j] /= n2;
      o0 += 4; o1 += 4;
    }
    for (const nd of c.ns) {
      for (let j = 0; j < 3; j++) S[k][nd * 3 + j] = d[o0 + j] + (d[o1 + j] - d[o0 + j]) * u;
      o0 += 3; o1 += 3;
    }
    for (let j = 0; j < 3; j++) {
      const x0 = c.travel[f0 * 3 + j], x1 = c.travel[f1 * 3 + j];
      TR[k][j] = x0 + (x1 - x0) * u;
    }
  }

  const P = {
    cur: null, t: 0, rate: 1, loop: true, done: true,
    prev: null, prevT: 0, prevRate: 1, prevLoop: true, fade: 0, fadeT: 0,
    // the last travel written, and the delta this step (model frame, metres)
    last: [0, 0, 0], delta: [0, 0, 0],
  };
  P.clipOf = (role, pick) => animalClip(a, role, pick);
  P.play = (clip, o) => {
    o = o || {};
    if (typeof clip === 'string') clip = P.clipOf(clip, o.pick);
    if (!clip) return false;
    const c = inst.clips[clip.key] || clip;
    if (P.cur && P.cur.key === c.key && o.restart !== true) { P.loop = o.loop !== false; return true; }
    if (P.cur && o.fade > 0) { P.prev = P.cur; P.prevT = P.t; P.prevRate = P.rate; P.prevLoop = P.loop; P.fade = o.fade; P.fadeT = 0; }
    else { P.prev = null; P.fade = 0; }
    P.cur = c; P.t = o.at || 0; P.rate = o.rate || 1; P.loop = o.loop !== false; P.done = false;
    P.last = [0, 0, 0];
    return true;
  };
  // advance the clock and write the pose; returns the travel delta
  P.step = function (dt, write) {
    P.delta[0] = P.delta[1] = P.delta[2] = 0;
    const c = P.cur;
    if (!c) return P.delta;
    P.t += dt * P.rate;
    if (P.t >= c.dur) {
      if (P.loop) {
        // a looping gait carries its travel over the seam: the whole clip's
        // displacement is banked and the clock wraps
        const laps = Math.floor(P.t / Math.max(1e-6, c.dur));
        P.t -= laps * c.dur;
        for (let j = 0; j < 3; j++) { P.delta[j] += (c.travel[(c.frames - 1) * 3 + j] - P.last[j]) * laps; P.last[j] = 0; }
      } else { P.t = c.dur; P.done = true; }
    }
    sampleInto(c, P.t, 0);
    let w = 1;
    if (P.prev) {
      P.fadeT += dt;
      w = Math.min(1, P.fadeT / Math.max(1e-6, P.fade));
      P.prevT += dt * P.prevRate;
      if (P.prevT >= P.prev.dur) P.prevT = P.prevLoop ? P.prevT % P.prev.dur : P.prev.dur;
      sampleInto(P.prev, P.prevT, 1);
      if (w >= 1) P.prev = null;
    }
    for (let j = 0; j < 3; j++) { P.delta[j] += TR[0][j] - P.last[j]; P.last[j] = TR[0][j]; }
    if (write) {
      const objs = inst.objs;
      for (let i = 0; i < N; i++) {
        const o = objs[i];
        if (w >= 1 || !P.prev) {
          o.position.set(T[0][i * 3], T[0][i * 3 + 1], T[0][i * 3 + 2]);
          o.quaternion.set(R[0][i * 4], R[0][i * 4 + 1], R[0][i * 4 + 2], R[0][i * 4 + 3]);
          o.scale.set(S[0][i * 3], S[0][i * 3 + 1], S[0][i * 3 + 2]);
        } else {
          o.position.set(T[1][i * 3] + (T[0][i * 3] - T[1][i * 3]) * w,
                         T[1][i * 3 + 1] + (T[0][i * 3 + 1] - T[1][i * 3 + 1]) * w,
                         T[1][i * 3 + 2] + (T[0][i * 3 + 2] - T[1][i * 3 + 2]) * w);
          let dot = 0;
          for (let j = 0; j < 4; j++) dot += R[0][i * 4 + j] * R[1][i * 4 + j];
          const sgn = dot < 0 ? -1 : 1;
          let x = 0, y = 0, z = 0, q = 0, n2 = 0;
          const lerp1 = (b0, b1) => b1 + (sgn * b0 - b1) * w;
          x = lerp1(R[0][i * 4], R[1][i * 4]); y = lerp1(R[0][i * 4 + 1], R[1][i * 4 + 1]);
          z = lerp1(R[0][i * 4 + 2], R[1][i * 4 + 2]); q = lerp1(R[0][i * 4 + 3], R[1][i * 4 + 3]);
          n2 = Math.sqrt(x * x + y * y + z * z + q * q) || 1;
          o.quaternion.set(x / n2, y / n2, z / n2, q / n2);
          o.scale.set(S[1][i * 3] + (S[0][i * 3] - S[1][i * 3]) * w,
                      S[1][i * 3 + 1] + (S[0][i * 3 + 1] - S[1][i * 3 + 1]) * w,
                      S[1][i * 3 + 2] + (S[0][i * 3 + 2] - S[1][i * 3 + 2]) * w);
        }
      }
    }
    return P.delta;
  };
  return P;
}

// ---- THE LADDER -----------------------------------------------------------
// the levels of an animal, off the prop registry, ascending (the pack
// tools/animal_lod.js writes: `lodOf` is the ANIMAL's key)
const LEVELS = new Map();
function levels(key) {
  let lv = LEVELS.get(key);
  if (lv) return lv;
  lv = (typeof PROP_REG === 'undefined' ? [] : PROP_REG.order.map(k => PROP_REG.props[k]))
    .filter(p => p && p.lodOf === key)
    .map(p => ({ key: p.key, dist: p.lodDist }))
    .sort((a, b) => a.dist - b.dist);
  LEVELS.set(key, lv);
  return lv;
}

// place(THREE, key) -> a handle. The object goes into the scene; `step(dt)`
// runs the clock; `play(role, opts)` chains a clip; `loomSet(depth)` fades the
// under-water copy in. Everything is null-safe before the bytes land: the
// handle is returned at once and fills itself when the fetch does.
function place(THREE, key, o) {
  o = o || {};
  const a = reg(key);
  if (!a) return null;
  const lv = levels(key);
  const root = (lv.length && THREE.LOD) ? new THREE.LOD() : new THREE.Group();
  root.name = 'animal:' + key;
  const piv = a.pivot || [0, 0, 0];
  const L0 = new THREE.Group();
  L0.position.set(-piv[0], -piv[1], -piv[2]);
  if (root.isLOD) root.addLevel(L0, 0); else root.add(L0);
  for (const l of lv) {
    const g = new THREE.Group();
    g.position.set(-piv[0], -piv[1], -piv[2]);
    if (typeof propMesh === 'function') g.add(propMesh(THREE, l.key));
    root.addLevel(g, l.dist);
  }
  const H = { key, a, obj: root, inst: null, player: null, L0, pivot: piv,
              loomList: null, loomMats: null, pending: null, ready: false };
  // A PLAY ASKED FOR BEFORE THE BYTES LAND IS REMEMBERED, not dropped: the
  // behaviour starts its first bout the moment it sows the herd, and the
  // payload is still on the wire. Without this the animal stands in its rest
  // pose until the machine's next dwell (seconds later, and visibly wrong).
  H.play = (role, opt) => { if (!H.player) { H.pending = [role, opt]; return true; } return H.player.play(role, opt); };
  H.clip = () => (H.player && H.player.cur ? H.player.cur : null);
  H.done = () => !H.player || H.player.done;
  // the skeleton is only written when level 0 is the visible one — a herd at
  // 300 m keeps its clock and pays nothing for bones it cannot show
  H.step = dt => {
    if (!H.player) return NO_MOVE;
    return H.player.step(dt, L0.visible !== false);
  };
  H.dispose = () => {
    if (H.loomMats) for (const m of H.loomMats) m.dispose();
    H.loomMats = H.loomList = null;
    if (root.parent) root.parent.remove(root);
  };
  // THE LOOM: `depth` is how far the animal's pivot is UNDER the surface, in
  // metres. The copies are SKINNED off the same skeleton (so the loom swims
  // with the animal and costs no second pose) and their materials are this
  // handle's own clones, so two whales at two depths fade independently.
  // Nothing is built until the first submerged frame asks for it.
  H.loomSet = depth => {
    if (!H.inst) return;
    const fade = a.sea ? Math.max(4, a.sea.depth * 0.5) : 8;
    const k = depth > 0.2 ? 0.62 * Math.exp(-depth / fade) : 0;
    if (!H.loomList) {
      if (k < 0.01) return;
      const b = BUILT.get(key);
      H.loomMats = loomMats(THREE, b).map(m => m.clone());
      H.loomList = [];
      b.dec.meshes.forEach((m, i) => {
        if (!m.skin) return;                    // a rigid child is not worth a second draw
        const sm = new THREE.SkinnedMesh(b.geos[i], H.loomMats[m.mat]);
        sm.name = 'animalLoom:' + key;
        sm.frustumCulled = false; sm.castShadow = false; sm.receiveShadow = false;
        sm.renderOrder = 12;                    // after the water, which is transparent
        sm.raycast = () => {};
        H.inst.objs[m.node].add(sm);
        sm.bind(H.inst.skeleton, new THREE.Matrix4());
        H.loomList.push(sm);
      });
    }
    for (const m of H.loomMats) m.opacity = k;
    for (const q of H.loomList) q.visible = k > 0.01;
  };
  const fill = () => {
    H.inst = instance(THREE, key);
    L0.add(H.inst.root);
    H.player = makePlayer(H.inst);
    H.ready = true;
    if (H.pending) { H.player.play(H.pending[0], H.pending[1]); H.pending = null; }
    if (o.onReady) o.onReady(H);
  };
  if (ready(key)) fill();
  else warm(key).then(fill).catch(e => { if (typeof console !== 'undefined') console.warn('animal ' + key + ':', e && e.message); });
  return H;
}
const NO_MOVE = [0, 0, 0];

A.reg = reg;
A.list = list;
A.warm = warm;
A.ready = ready;
A.build = build;
A.instance = instance;
A.place = place;
A.levels = levels;
A.makePlayer = makePlayer;
A.BUILT = BUILT;
if (typeof window !== 'undefined') window.ANIMALS = A;
if (typeof module !== 'undefined' && module.exports) module.exports = A;
})();
