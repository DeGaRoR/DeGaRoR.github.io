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
// play at once: `play(role, {fade})` keeps the outgoing one (or the pose on
// screen, frozen) and blends TRS to the incoming over at least `fade` seconds,
// eased, and as long as the head has to travel (THE MOTION RULES below,
// ANIMALS-MOTION 15 Nov). Nothing else is ever blended — no masks, no layers,
// no additive tracks, no joint curve. The user's ruling, 2026-09-22: "just do
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
  // ONE MATERIAL PER RECORD (AS4a): the animal's record and its cut levels' (the same record, props.js's factory)
  // are one MATLIB material; named by the first to ask
  const mats = a.mats.map(rec => {
    const m = propMaterial(THREE, rec);
    if (!m.name) m.name = 'animal:' + key + ':' + (rec.name || '');
    return m;
  });
  b = { a, dec, clips, geos, mats, loom: null, skinDraw: skinDraw(THREE, a, dec, geos) };
  BUILT.set(key, b);
  BINS.delete(key);                            // the decoded arrays are the keeper now
  return b;
}

// THE SKINNED PARTS AS ONE DRAW (AS4a-rest, G941; MATLIB's array shapes). An animal's skinned meshes all bind the ONE
// skeleton, with the identity (their nodes' transforms are cancelled: three's 'attached' bind), so two of them are the
// same draw but for their records - the bird is a black body and a yellow beak, 15 birds 30 draws. Where every such
// mesh's record can be a ROW (props.js propArrSpec: no map, a flat constant or KTX2 twins; not glass, not glow), they
// are ONE geometry carrying each vertex's row, drawn by the array shape's skinned sibling. The meshes themselves stay
// (`geos`: the loom's copies, the cut levels' props). null: nothing to merge (fewer than two, a record that cannot).
function skinDraw(THREE, a, dec, geos) {
  if (typeof MATLIB === 'undefined' || !MATLIB.arr || !MATLIB.arr.on || typeof propArrSpec !== 'function') return null;
  const parts = [];
  dec.meshes.forEach((m, i) => { if (m.skin) parts.push(i); });
  if (parts.length < 2) return null;
  const specs = parts.map(i => propArrSpec(THREE, a.mats[dec.meshes[i].mat]));
  if (specs.some(x => !x)) return null;
  const pages = {}, side = a.mats[dec.meshes[parts[0]].mat].dbl ? 2 : 0;
  for (const [j, i] of parts.entries()) {
    const rec = a.mats[dec.meshes[i].mat], sp = specs[j];
    if ((rec.dbl ? 2 : 0) !== side || !!rec.flat) return null;
    for (const k of ['map', 'nor', 'arm']) if (sp[k] && sp[k].page) { if (pages[k] && pages[k] !== sp[k].page) return null; pages[k] = sp[k].page; }
  }
  const rows = specs.map(sp => MATLIB.arr.row(THREE, sp));
  let nv = 0, ni = 0; for (const i of parts) { nv += geos[i].attributes.position.count; ni += geos[i].index.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), jt = new Uint16Array(nv * 4), wt = new Float32Array(nv * 4),
    row = new Uint16Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, t = 0;
  parts.forEach((i, j) => {
    const A = geos[i].attributes, n = A.position.count, I = geos[i].index.array;
    pos.set(A.position.array, v * 3); nrm.set(A.normal.array, v * 3); uvs.set(A.uv.array, v * 2);
    jt.set(A.skinIndex.array, v * 4); wt.set(A.skinWeight.array, v * 4); row.fill(rows[j], v, v + n);
    for (let q = 0; q < I.length; q++) idx[t + q] = I[q] + v;
    v += n; t += I.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const uv = new THREE.BufferAttribute(uvs, 2);
  g.setAttribute('uv', uv); g.setAttribute('uv1', uv);
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(jt, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
  g.setAttribute('mlRow', new THREE.BufferAttribute(row, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.userData.parts = parts.slice(); g.userData.rows = rows;   // which meshes it draws, each one's row (GATE MATLIB)
  const mat = MATLIB.arr.material(THREE, { owner: 'animals / skinned draw / texture array', side, flat: false, pages });
  return { parts, geo: g, mat, name: parts.map(i => dec.meshes[i].name).join('+') };
}

// ---- THE LADDER, FAR OUT (ANIMALS-MOTION, 15 Nov 2026) -------------------------------------------------------------
// The user: "from far away the animals don't move their legs when they move ... static models hovering"; then: "static
// mesh is barely acceptable ... when the animal is only a few pixels large, possibly kilometers away ... their movement
// is realistic as soon as they can be observed ... do not modify the meshed and skinned and rigged model." G498 swapped
// the moving skin for the static cuts at 40 m (land) / 90 m (sea), so a walking elk 41 m off slid along as a statue. The
// whole skinned animal now stands until its LENGTH covers MOTION.lodPx[0] pixels on a 1080p screen (1 094 px a radian,
// props.js's PROP_CULL_K basis: an elk 456 m, a doe 292 m, a bear 401 m, an orca 1.3 km); the baked cuts, untouched,
// only past that (the second at lodPx[1]). The table's own distance stays the floor.
const PX_PER_RAD = 1094;
function farDist(a, li, dist) {
  const px = MOTION.lodPx[Math.min(li, MOTION.lodPx.length - 1)];
  return MOTION.far ? Math.max(dist, (a.length || 1) * PX_PER_RAD / px) : dist;
}

// the LOOM materials, made on demand (only the sea animals ever ask): the
// animal's own colour map, unlit, drawn over the water
function loomMats(THREE, b) {
  if (b.loom) return b.loom;
  b.loom = b.a.mats.map(rec => {
    const o = { color: new THREE.Color(rec.col[0], rec.col[1], rec.col[2]),
                transparent: true, opacity: 0, depthTest: false, depthWrite: false,
                side: rec.dbl ? THREE.DoubleSide : THREE.FrontSide, toneMapped: true, fog: false };
    if (rec.map && typeof propTexture === 'function') o.map = propTexture(THREE, rec.map, true, 'color');
    const m = MATLIB.make(THREE, 'basic', o, 'animals / sea loom / unlit colour');  // pre-ok: its colour held x P on the next line
    m.name = 'animalLoom:' + b.a.key;
    if (typeof LIGHT_RIG !== 'undefined' && LIGHT_RIG.preHold) LIGHT_RIG.preHold(m.color, 'rgb');   // G2620: an unlit colour in the world's frame x P
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
  const SD = b.skinDraw, merged = SD ? new Set(SD.parts) : null;
  const meshes = b.dec.meshes.map((m, i) => {
    let o;
    if (merged && merged.has(i)) {
      if (i !== SD.parts[0]) return null;          // drawn by the first's merged mesh
      o = new THREE.SkinnedMesh(SD.geo, MATLIB.variant(THREE, SD.mat, 'skin'));
      objs[m.node].add(o);
      o.bind(skeleton, new THREE.Matrix4());
      o.frustumCulled = false;
      o.name = 'animal:' + key + ':' + SD.name;
      o.castShadow = true; o.receiveShadow = true;
      o.userData.sharedGeo = true;
      o.raycast = () => {};
      return o;
    }
    if (m.skin) {
      o = new THREE.SkinnedMesh(b.geos[i], MATLIB.variant(THREE, b.mats[m.mat], 'skin'));   // the record's skinned sibling (MATLIB.variant)
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
  return { key, a, b, root, objs, bones, skeleton, meshes: meshes.filter(Boolean), clips: b.clips };
}

// ---- THE MOTION RULES (ANIMALS-MOTION, 15 Nov 2026) -------------------------
// The user, 15 Nov: "the animals don't behave correctly; no walking animation when they turn, harsh transition when
// they bend their heads." Three rules here, none of them a joint curve (G498's ruling stands: the vendors' clips only):
//   EASE   a cross-fade's weight is a smoothstep, not a ramp: no velocity kink at either end of it.
//   SPAN   a cross-fade lasts as long as the HEAD has to travel: long enough that the fade's own peak head speed
//          (1.5 x angle / time, a smoothstep's) stays under fadeCap - 0.3 s for a shift, ~1 s for a head that comes up
//          from the grass, up to fadeMax. The angle is the head's, in the model frame, from the pose on screen to the
//          incoming clip's first frame. The caller's own fade is the floor. The BODY likewise: no limb, spine or neck
//          bone faster than bodyCap through the fade (the face's small bones excepted).
//   PACE   a land animal's non-gait clip plays slower where its own head moves faster than headCap: the doe's and the
//          elk's Stand_Eating_01 drops the head 60 deg in 0.4 s (150 deg/s, on 10 fps keys) - played paced, that dip
//          takes ~0.8 s. The rate looks `look` seconds ahead, so the slow-down starts before the fast part does.
//          Gaits (walk, trot, toWalk) are never paced: their stride is their ground speed.
// FROZEN  a fade leaves the pose on screen as it was when it began, unless the outgoing clip is a GAIT (a walk fading
//          to a stand keeps its legs - and its travel - going under the fade). A grazing clip that kept playing would
//          push the head down while the fade lifts it. A fade interrupted by another play() leaves the pose on screen too.
// The flags exist for GATE ANIMOTION's negative control (tools/_animal_motion_check.js): off = the G498 player.
const MOTION = { ease: true, span: true, pace: true, far: true, lodPx: [6, 3], headCap: 90, fadeCap: 75, bodyCap: 120, look: 0.3, fadeMin: 0.3, fadeMax: 1.8 };
const GAIT = { walk: 1, trot: 1, toWalk: 1 };
const smooth01 = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// the head's chain, root first ([] for an animal with no head bone: the sea and the air)
function headChain(a) {
  if (a._headChain) return a._headChain;
  const joints = new Set(a.joints);
  let h = -1;
  a.nodes.forEach((n, i) => { if (h < 0 && joints.has(i) && /head/i.test(n.n)) h = i; });
  const ch = [];
  for (let i = h; i >= 0; i = a.nodes[i].p) ch.unshift(i);
  a._headChain = ch;
  return ch;
}
// THE HEAD'S FRAME: its three axes in the model frame, through the chain's rotations AND scales (the bear's rig scales
// its body 1.2 x 1.2 x 1.1 under a 0.01: a rotation-only chain misreads its head's swing by a third). M = M x R(q) S,
// in place in a 9-array, column-major
const _N = new Float64Array(9), _P = new Float64Array(9);
function m3mulRS(M, x, y, z, w, sx, sy, sz) {
  const N = _N;
  N[0] = (1 - 2 * (y * y + z * z)) * sx; N[1] = 2 * (x * y + z * w) * sx; N[2] = 2 * (x * z - y * w) * sx;
  N[3] = 2 * (x * y - z * w) * sy; N[4] = (1 - 2 * (x * x + z * z)) * sy; N[5] = 2 * (y * z + x * w) * sy;
  N[6] = 2 * (x * z + y * w) * sz; N[7] = 2 * (y * z - x * w) * sz; N[8] = (1 - 2 * (x * x + y * y)) * sz;
  const P = _P;
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++)
    P[3 * c + r] = M[r] * N[3 * c] + M[3 + r] * N[3 * c + 1] + M[6 + r] * N[3 * c + 2];
  for (let k = 0; k < 9; k++) M[k] = P[k];
}
const m3id = M => { M[0] = M[4] = M[8] = 1; M[1] = M[2] = M[3] = M[5] = M[6] = M[7] = 0; };
// columns to unit length (the axes' directions are what the eye reads)
function m3axes(M, out, o) {
  for (let c = 0; c < 3; c++) {
    const n = Math.hypot(M[3 * c], M[3 * c + 1], M[3 * c + 2]) || 1;
    for (let r = 0; r < 3; r++) out[o + 3 * c + r] = M[3 * c + r] / n;
  }
}
// the swing between two head frames: the largest angle any of its three axes turns through, radians
function axAng(A, ao, B, bo) {
  let m = 0;
  for (let c = 0; c < 3; c++) {
    const d = A[ao + 3 * c] * B[bo + 3 * c] + A[ao + 3 * c + 1] * B[bo + 3 * c + 1] + A[ao + 3 * c + 2] * B[bo + 3 * c + 2];
    const g = Math.acos(Math.max(-1, Math.min(1, d)));
    if (g > m) m = g;
  }
  return m;
}
// the head's frame in every frame of a clip: Float32Array(9 x frames), made once per clip and kept on the decoded clip
function headTrack(a, c) {
  if (c.headQ !== undefined) return c.headQ;
  const ch = headChain(a);
  if (!ch.length) { c.headQ = null; return null; }
  const nrAt = new Map(), nsAt = new Map();
  c.nr.forEach((nd, j) => nrAt.set(nd, j)); c.ns.forEach((nd, j) => nsAt.set(nd, j));
  const offR = 3 * c.nt.length, offS = offR + 4 * c.nr.length, out = new Float32Array(9 * c.frames), M = new Float64Array(9);
  const d = c.data;
  for (let f = 0; f < c.frames; f++) {
    m3id(M);
    for (const nd of ch) {
      const n = a.nodes[nd], j = nrAt.get(nd), k = nsAt.get(nd), b = f * c.stride;
      const r = j === undefined ? n.r : [d[b + offR + 4 * j], d[b + offR + 4 * j + 1], d[b + offR + 4 * j + 2], d[b + offR + 4 * j + 3]];
      const sc = k === undefined ? n.s : [d[b + offS + 3 * k], d[b + offS + 3 * k + 1], d[b + offS + 3 * k + 2]];
      const qn = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
      m3mulRS(M, r[0] / qn, r[1] / qn, r[2] / qn, r[3] / qn, sc[0], sc[1], sc[2]);
    }
    m3axes(M, out, 9 * f);
  }
  c.headQ = out;
  return out;
}
// THE BODY'S FRAMES (the SPAN over every limb): every node's model frame, top down, rotations and scales; `local(nd, out4,
// outS3)` gives a node's local rotation and scale. The bones read are the BODY's - not the face (jaw, tongue, eyelids,
// ears: small, and fast by nature) - and the angle is the largest any of them turns between two poses.
const BODY_SKIP = /jaw|tongue|eyelid|ear\d|ear_|eye/i;
function bodyList(a) {
  if (a._body) return a._body;
  const J = new Set(a.joints);
  a._body = a.nodes.map((n, i) => i).filter(i => J.has(i) && !BODY_SKIP.test(a.nodes[i].n) && !/^_?root/i.test(a.nodes[i].n.replace(/^Rig/, '')));
  return a._body;
}
function bodyFrames(a, local, out) {
  const N = a.nodes.length, W = a._W || (a._W = new Float64Array(9 * N)), done = a._D || (a._D = new Uint8Array(N));
  done.fill(0);
  const q = [0, 0, 0, 1], sc = [1, 1, 1], M = new Float64Array(9);
  const fk = i => {
    if (done[i]) return;
    const p = a.nodes[i].p;
    if (p >= 0) { fk(p); for (let k = 0; k < 9; k++) M[k] = W[9 * p + k]; } else m3id(M);
    local(i, q, sc);
    const qn = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    m3mulRS(M, q[0] / qn, q[1] / qn, q[2] / qn, q[3] / qn, sc[0], sc[1], sc[2]);
    for (let k = 0; k < 9; k++) W[9 * i + k] = M[k];
    done[i] = 1;
  };
  const B = bodyList(a);
  for (let b = 0; b < B.length; b++) { fk(B[b]); for (let k = 0; k < 9; k++) M[k] = W[9 * B[b] + k]; m3axes(M, out, 9 * b); }
  return out;
}
// the body's frames in one frame of a clip
function bodyAt(a, c, f) {
  const nrAt = c._nrAt || (c._nrAt = new Map(c.nr.map((nd, j) => [nd, j]))), nsAt = c._nsAt || (c._nsAt = new Map(c.ns.map((nd, j) => [nd, j])));
  const offR = 3 * c.nt.length, offS = offR + 4 * c.nr.length, d = c.data, base = f * c.stride;
  const out = new Float32Array(9 * bodyList(a).length);
  return bodyFrames(a, (i, q, sc) => {
    const n = a.nodes[i], j = nrAt.get(i), k = nsAt.get(i);
    if (j === undefined) { q[0] = n.r[0]; q[1] = n.r[1]; q[2] = n.r[2]; q[3] = n.r[3]; } else { const o = base + offR + 4 * j; q[0] = d[o]; q[1] = d[o + 1]; q[2] = d[o + 2]; q[3] = d[o + 3]; }
    if (k === undefined) { sc[0] = n.s[0]; sc[1] = n.s[1]; sc[2] = n.s[2]; } else { const o = base + offS + 3 * k; sc[0] = d[o]; sc[1] = d[o + 1]; sc[2] = d[o + 2]; }
  }, out);
}
// the largest turn any body bone makes between two sets of frames, radians
function bodyAng(A, B) { let m = 0; for (let b = 0; b < A.length / 9; b++) { const g = axAng(A, 9 * b, B, 9 * b); if (g > m) m = g; } return m; }

// THE PACE of a clip, per frame (<= 1): headCap over the head's own speed, the minimum over the next `look` seconds
function paceOf(a, c) {
  if (c.pace !== undefined) return c.pace;
  c.pace = null;
  if (a.kind !== 'land' || GAIT[c.role] || c.frames < 2) return null;
  const hq = headTrack(a, c);
  if (!hq) return null;
  const cap = MOTION.headCap * Math.PI / 180, raw = new Float32Array(c.frames), p = new Float32Array(c.frames);
  let slow = false;
  for (let f = 0; f < c.frames; f++) {
    const g = Math.min(c.frames - 1, f + 1);
    const sp = axAng(hq, 9 * f, hq, 9 * g) * c.fps;
    raw[f] = sp > cap ? cap / sp : 1;
    if (raw[f] < 1) slow = true;
  }
  if (!slow) return null;
  const look = Math.max(1, Math.round(MOTION.look * c.fps));
  for (let f = 0; f < c.frames; f++) { let m = 1; for (let g = f; g <= Math.min(c.frames - 1, f + look); g++) if (raw[g] < m) m = raw[g]; p[f] = m; }
  c.pace = p;
  return p;
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

  // the pose on screen, frozen, when a fade is interrupted (ANIMALS-MOTION): the next fade starts from it
  const FT = new Float32Array(N * 3), FR = new Float32Array(N * 4), FS = new Float32Array(N * 3);
  const FROZEN = { key: '(frozen)', frozen: true, dur: 0 };
  const CD = [0, 0, 0], PD = [0, 0, 0];               // this step's travel: the incoming clip's, the outgoing one's
  const HM = new Float64Array(9), HQ = new Float32Array(9), BN = new Float32Array(9 * bodyList(a).length);
  // the head's frame as the pose on screen has it (the objects ARE the pose last written)
  function headNow(out) {
    const ch = headChain(a);
    m3id(HM);
    for (const nd of ch) { const o = inst.objs[nd], q = o.quaternion, sc = o.scale; m3mulRS(HM, q.x, q.y, q.z, q.w, sc.x, sc.y, sc.z); }
    m3axes(HM, out, 0);
    return ch.length > 0;
  }
  // a clip's clock forward by `adv` seconds of clip time, its travel banked into D; the new clock
  function advance(c, t, adv, loop, last, D, P) {
    t += adv;
    if (t >= c.dur) {
      if (loop) {
        // a looping gait carries its travel over the seam: the whole clip's
        // displacement is banked and the clock wraps
        const laps = Math.floor(t / Math.max(1e-6, c.dur));
        t -= laps * c.dur;
        for (let j = 0; j < 3; j++) { D[j] += (c.travel[(c.frames - 1) * 3 + j] - last[j]) * laps; last[j] = 0; }
      } else { t = c.dur; if (P) P.done = true; }
    }
    return t;
  }

  const P = {
    cur: null, t: 0, rate: 1, loop: true, done: true,
    prev: null, prevT: 0, prevRate: 1, prevLoop: true, fade: 0, fadeT: 0,
    // the last travel written, and the delta this step (model frame, metres)
    last: [0, 0, 0], prevLast: [0, 0, 0], delta: [0, 0, 0],
    pace: 1, prevPace: 1,                             // the PACE now (ANIMALS-MOTION), smoothed; the outgoing clip's
    wrote: false,                                     // the last step wrote the objects (level 0 shown)
  };
  P.clipOf = (role, pick) => animalClip(a, role, pick);
  P.play = (clip, o) => {
    o = o || {};
    if (typeof clip === 'string') clip = P.clipOf(clip, o.pick);
    if (!clip) return false;
    const c = inst.clips[clip.key] || clip;
    if (P.cur && P.cur.key === c.key && o.restart !== true) { P.loop = o.loop !== false; return true; }
    const at = o.at || 0;
    if (P.cur && o.fade > 0) {
      let fade = o.fade;
      // SPAN: as long as the head has to travel, from the pose on screen to the incoming clip's first frame
      const hq = MOTION.span && P.wrote ? headTrack(a, c) : null;
      if (hq && headNow(HQ)) {
        const f = Math.min(c.frames - 1, Math.max(0, Math.round(at * c.fps)));
        fade = Math.max(fade, MOTION.fadeMin, Math.min(MOTION.fadeMax, 1.5 * axAng(HQ, 0, hq, 9 * f) / (MOTION.fadeCap * Math.PI / 180)));
      }
      // ...and as long as the BODY has to travel: no limb, spine or neck bone faster than bodyCap through the fade
      // (a bear getting up into a walk: its legs were swung into the stride in 0.3 s)
      if (MOTION.span && P.wrote && a.kind === 'land' && bodyList(a).length) {
        const f = Math.min(c.frames - 1, Math.max(0, Math.round(at * c.fps)));
        const now = bodyFrames(a, (i, q, sc) => { const o = inst.objs[i]; q[0] = o.quaternion.x; q[1] = o.quaternion.y; q[2] = o.quaternion.z; q[3] = o.quaternion.w; sc[0] = o.scale.x; sc[1] = o.scale.y; sc[2] = o.scale.z; }, BN);
        fade = Math.max(fade, Math.min(MOTION.fadeMax, 1.5 * bodyAng(now, bodyAt(a, c, f)) / (MOTION.bodyCap * Math.PI / 180)));
      }
      if (P.wrote && ((P.prev && P.fadeT < P.fade) || (MOTION.span && !GAIT[P.cur.role]))) {
        // a fade cut short, or a pose that is not a stride: the pose on screen is the one to leave, frozen
        const objs = inst.objs;
        for (let i = 0; i < N; i++) {
          const ob = objs[i];
          FT[i * 3] = ob.position.x; FT[i * 3 + 1] = ob.position.y; FT[i * 3 + 2] = ob.position.z;
          FR[i * 4] = ob.quaternion.x; FR[i * 4 + 1] = ob.quaternion.y; FR[i * 4 + 2] = ob.quaternion.z; FR[i * 4 + 3] = ob.quaternion.w;
          FS[i * 3] = ob.scale.x; FS[i * 3 + 1] = ob.scale.y; FS[i * 3 + 2] = ob.scale.z;
        }
        P.prev = FROZEN; P.prevT = 0; P.prevRate = 0; P.prevLoop = false;
      } else { P.prev = P.cur; P.prevT = P.t; P.prevRate = P.rate; P.prevPace = P.pace; P.prevLoop = P.loop; P.prevLast[0] = P.last[0]; P.prevLast[1] = P.last[1]; P.prevLast[2] = P.last[2]; }
      P.fade = fade; P.fadeT = 0;
    }
    else { P.prev = null; P.fade = 0; }
    P.cur = c; P.t = at; P.rate = o.rate || 1; P.loop = o.loop !== false; P.done = false;
    const pc = paceOf(a, c);
    P.pace = pc ? pc[Math.min(c.frames - 1, Math.floor(at * c.fps))] : 1;
    // the travel's zero is the clip's own at `at` (a clip started part-way does not bank the part it skipped)
    if (P.last.length !== 3) P.last = [0, 0, 0];
    const f0 = Math.min(c.frames - 1, Math.max(0, Math.floor(at * c.fps)));
    P.last[0] = at > 0 ? c.travel[f0 * 3] : 0; P.last[1] = at > 0 ? c.travel[f0 * 3 + 1] : 0; P.last[2] = at > 0 ? c.travel[f0 * 3 + 2] : 0;
    return true;
  };
  // advance the clock and write the pose; returns the travel delta
  P.step = function (dt, write) {
    const D = P.delta;
    D[0] = D[1] = D[2] = 0;
    const c = P.cur;
    if (!c) return D;
    // THE PACE (ANIMALS-MOTION): the clip's clock slows where its own head would move faster than headCap
    const pc = MOTION.pace ? paceOf(a, c) : null;
    if (pc) {
      const want = pc[Math.min(c.frames - 1, Math.max(0, Math.floor(P.t * c.fps)))];
      P.pace += (want - P.pace) * Math.min(1, dt / 0.12);
    } else P.pace = 1;
    CD[0] = CD[1] = CD[2] = 0;
    // RAMP: through a fade, an incoming clip that is not a gait runs its clock at the fade's progress - the fade carries
    // the head to the clip's pose first, the clip's own motion takes over as the fade ends (the bear's head would
    // otherwise drop with the fade AND with Stand_Eating_01's own dip at once). A gait keeps its stride: its clock is
    // its ground speed.
    const ramp = P.prev && MOTION.span && !GAIT[c.role] ? Math.max(0.15, Math.min(1, (P.fadeT + dt) / Math.max(1e-6, P.fade))) : 1;
    P.t = advance(c, P.t, dt * P.rate * P.pace * ramp, P.loop, P.last, CD, P);
    sampleInto(c, P.t, 0);
    for (let j = 0; j < 3; j++) { CD[j] += TR[0][j] - P.last[j]; P.last[j] = TR[0][j]; }
    let w = 1;
    if (P.prev) {
      P.fadeT += dt;
      const u = Math.min(1, P.fadeT / Math.max(1e-6, P.fade));
      w = MOTION.ease ? smooth01(u) : u;
      PD[0] = PD[1] = PD[2] = 0;
      if (P.prev.frozen) { T[1].set(FT); R[1].set(FR); S[1].set(FS); }
      else {
        const pv = P.prev, pp = MOTION.pace ? paceOf(a, pv) : null;   // the outgoing clip keeps its own pace through the fade
        if (pp) P.prevPace += (pp[Math.min(pv.frames - 1, Math.max(0, Math.floor(P.prevT * pv.fps)))] - P.prevPace) * Math.min(1, dt / 0.12);
        else P.prevPace = 1;
        P.prevT = advance(pv, P.prevT, dt * P.prevRate * P.prevPace, P.prevLoop, P.prevLast, PD, null);
        sampleInto(pv, P.prevT, 1);
        for (let j = 0; j < 3; j++) { PD[j] += TR[1][j] - P.prevLast[j]; P.prevLast[j] = TR[1][j]; }
      }
      if (u >= 1) { P.prev = null; w = 1; }
    }
    // THE TRAVEL through a fade is the two clips' own, by the same weight as the pose: a walk fading to a stand
    // slows down with its legs, it does not stop dead under them
    if (w < 1) for (let j = 0; j < 3; j++) D[j] = CD[j] * w + PD[j] * (1 - w);
    else for (let j = 0; j < 3; j++) D[j] = CD[j];
    P.wrote = !!write;
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
          const sgn = dot < 0 ? -1 : 1, r0 = R[0], r1 = R[1], k = i * 4;
          // (inline, no closure: this runs per node per frame for every animal in a fade)
          const x = r1[k] + (sgn * r0[k] - r1[k]) * w, y = r1[k + 1] + (sgn * r0[k + 1] - r1[k + 1]) * w;
          const z = r1[k + 2] + (sgn * r0[k + 2] - r1[k + 2]) * w, q = r1[k + 3] + (sgn * r0[k + 3] - r1[k + 3]) * w;
          const n2 = Math.sqrt(x * x + y * y + z * z + q * q) || 1;
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

// THE CORE (SWIMMERS, 15-16 Nov 2026): the capsules INSIDE a sea animal's body, in its handle's frame (the pivot at the
// origin, +z forward, before the individual's size). The trunk { cy, cz, r, h }: the centre (0, cy, cz), the radius, the
// half-length of the axis along z; core.seg: the head and the tail stock, each { a, b, r } (the axis's two ends in the handle's
// frame) and, when the skin has bones, { mi, bi, A, B }: the bone that carries most of that section's skin (mesh mi's
// skeleton, bone bi) and the two ends in THAT bone's rest frame - so the tail's capsule beats with the flukes. The water reads
// them to open its column over the body (water.js setSubmerged), and a capsule that spilled past the skin opened the water
// onto nothing (the first slot, 15 Nov: a turquoise lozenge around every orca, the clear colour behind the sea). So each is
// fitted from the rest pose's own skin, once per species: a section (the trunk 30-80 % of the length from the tail, the tail
// stock 14-30 %, the head 80-95 %) cut in slices; a slice's centre the enclosed point farthest from the skin (a grid over
// the slice), that clearance its inscribed radius; the capsule's radius 0.85 of the lower quartile's, its caps inside the
// section's ends. The trunk alone (the first slot's) left the head and the tail under the bed's full column: a body seen
// through the sea in its middle only, the user 16 Nov: "the transparency seems random for the orcas". Read-only on the model.
function seaCore(THREE, H) {
  const b = BUILT.get(H.key);
  if (b && b.core) return b.core;
  const root = H.obj;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), v = new THREE.Vector3();
  const P = [], VM = [];                                  // the skin in the handle's frame; each vertex's [mesh, index]
  H.inst.meshes.forEach((m, mi) => {
    if (!m.geometry || !m.geometry.attributes.position) return;
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) {
      if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(m.geometry.attributes.position, i);
      v.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      P.push(v.x, v.y, v.z); VM.push(mi, i);
    }
  });
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 2; i < P.length; i += 3) { z0 = Math.min(z0, P[i]); z1 = Math.max(z1, P[i]); }
  const L = z1 - z0;
  const med = arr => { const c = arr.slice().sort((p, q) => p - q); return c.length ? c[c.length >> 1] : 0; };
  // a section zA..zB in NS slices -> { zs, cys, rs } of the slices whose centre is enclosed
  function slices(zA, zB, NS) {
    const zs = [], rs = [], cys = [];
    for (let s = 0; s < NS; s++) {
      const lo = zA + (zB - zA) * s / NS, hi = lo + (zB - zA) / NS, xs = [], ys = [];
      for (let i = 0; i < P.length; i += 3) if (P[i + 2] >= lo && P[i + 2] < hi) { xs.push(P[i]); ys.push(P[i + 1]); }
      if (xs.length < 6) continue;
      // the centre: the point of the slice's box farthest from any skin vertex among those ENCLOSED by the skin (a vertex in
      // each of 8 directions around it) - inside the body; never in the gap under a hanging flipper or beside a fin
      let yLo = Infinity, yHi = -Infinity, xLo = Infinity, xHi = -Infinity;
      for (const y of ys) { yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
      for (const x of xs) { xLo = Math.min(xLo, x); xHi = Math.max(xHi, x); }
      let cy = 0, best = 0;
      const G = 24;
      for (let gi = 1; gi < G; gi++) for (let gj = 1; gj < G; gj++) {
        const px = xLo + (xHi - xLo) * gi / G, py = yLo + (yHi - yLo) * gj / G;
        let d2 = Infinity, sec = 0;
        for (let j = 0; j < xs.length; j++) {
          const ex = xs[j] - px, ey = ys[j] - py;
          d2 = Math.min(d2, ex * ex + ey * ey);
          sec |= 1 << (((Math.atan2(ey, ex) + Math.PI) / (Math.PI / 4)) & 7);
        }
        if (sec === 255 && d2 > best * best) { best = Math.sqrt(d2); cy = py; }
      }
      if (!(best > 0)) continue;
      zs.push((lo + hi) / 2); rs.push(best); cys.push(cy);
    }
    return { zs, cys, rs };
  }
  const zA = z0 + 0.3 * L, zB = z0 + 0.8 * L;
  const T = slices(zA, zB, 8);
  if (T.cys.length < 3) return null;
  const r = 0.85 * T.rs.slice().sort((p, q) => p - q)[Math.floor(T.rs.length / 4)], core = { cy: med(T.cys), cz: (zA + zB) / 2, r, h: Math.max(0, (zB - zA) / 2 - r), seg: [] };
  // the head and the tail stock: a capsule along the slices' own centre line (a least-squares line: the head drops, the
  // stock rises to the flukes), on the bone that carries most of its skin
  const rel = new THREE.Matrix4(), ri = new THREE.Matrix4();
  for (const [fa, fb] of [[0.14, 0.3], [0.8, 0.95]]) {
    const sA = z0 + fa * L, sB = z0 + fb * L, S = slices(sA, sB, 5);
    if (S.cys.length < 2) continue;
    const n = S.zs.length, mz = S.zs.reduce((p, q) => p + q, 0) / n, my = S.cys.reduce((p, q) => p + q, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (S.zs[i] - mz) * (S.cys[i] - my); sxx += (S.zs[i] - mz) ** 2; }
    const k = sxx > 0 ? sxy / sxx : 0, sr = 0.85 * S.rs.slice().sort((p, q) => p - q)[Math.floor(n / 4)];
    let za = sA + sr, zb = sB - sr;
    if (zb < za) za = zb = (sA + sB) / 2;
    // THE JOINT (16 Nov eve, slot 3: the trunk and a section met cap to cap, a pinch of full sea between them): the end
    // toward the trunk runs on into it by the trunk's radius, so the windows overlap and the body reads as one
    if (fb <= 0.3 + 1e-6) zb = Math.min(zA + r, zb + sr + r); else za = Math.max(zB - r, za - sr - r);
    const seg = { a: [0, my + k * (za - mz), za], b: [0, my + k * (zb - mz), zb], r: sr };
    // the bone: the most skin weight over the section's vertices
    const W = new Map();
    for (let i = 0; i < P.length / 3; i++) {
      const z = P[3 * i + 2];
      if (z < sA || z >= sB) continue;
      const m = H.inst.meshes[VM[2 * i]], j = VM[2 * i + 1];
      if (!m.isSkinnedMesh || !m.skeleton || !m.geometry.attributes.skinIndex) continue;
      const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
      for (let c = 0; c < 4; c++) { const w = SW.getComponent(j, c); if (w > 0) { const key = VM[2 * i] * 256 + SI.getComponent(j, c); W.set(key, (W.get(key) || 0) + w); } }
    }
    let bk = -1, bw = 0;
    for (const [key, w] of W) if (w > bw) { bw = w; bk = key; }
    if (bk >= 0) {
      const mi = bk >> 8, bi = bk & 255, bone = H.inst.meshes[mi].skeleton.bones[bi];
      if (bone) {
        rel.multiplyMatrices(inv, bone.matrixWorld); ri.copy(rel).invert();
        seg.mi = mi; seg.bi = bi;
        seg.A = v.fromArray(seg.a).applyMatrix4(ri).toArray(); seg.B = v.fromArray(seg.b).applyMatrix4(ri).toArray();
      }
    }
    core.seg.push(seg);
  }
  if (b) b.core = core;
  return core;
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
  lv.forEach((l, li) => {
    const g = new THREE.Group();
    g.position.set(-piv[0], -piv[1], -piv[2]);
    if (typeof propMesh === 'function') g.add(propMesh(THREE, l.key));
    root.addLevel(g, farDist(a, li, l.dist));        // THE LADDER, FAR OUT (ANIMALS-MOTION)
  });
  const H = { key, a, obj: root, inst: null, player: null, L0, pivot: piv,
              loomList: null, loomMats: null, core: null, pending: null, ready: false };
  // A PLAY ASKED FOR BEFORE THE BYTES LAND IS REMEMBERED, not dropped: the
  // behaviour starts its first bout the moment it sows the herd, and the
  // payload is still on the wire. Without this the animal stands in its rest
  // pose until the machine's next dwell (seconds later, and visibly wrong).
  H.play = (role, opt) => { if (!H.player) { H.pending = [role, opt]; return true; } return H.player.play(role, opt); };
  H.clip = () => (H.player && H.player.cur ? H.player.cur : null);
  H.done = () => !H.player || H.player.done;
  // the skeleton is only written when level 0 is the visible one — a herd at
  // 300 m keeps its clock and pays nothing for bones it cannot show (since ANIMALS-MOTION level 0 reaches until the
  // animal is a few pixels long: past that only the static cuts are drawn)
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
    if (a.sea) H.core = seaCore(THREE, H);
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
A.MOTION = MOTION;                     // ANIMALS-MOTION: the fade and pace rules (GATE ANIMOTION flips them for its control)
A.GAIT = GAIT;
A.headChain = headChain;
A.farDist = farDist;
A.seaCore = seaCore;                   // SWIMMERS: the trunk's inscribed capsule (the water's column over the body)
if (typeof window !== 'undefined') window.ANIMALS = A;
if (typeof module !== 'undefined' && module.exports) module.exports = A;
})();
