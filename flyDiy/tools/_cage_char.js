// CAGE CHAR — rigged characters for the crew layer (G204).
//
// The ATD-01 dummy in _cage_crew.js is a 21-bone skeleton with analytic IK
// that finds the grips from the control positions. A Mixamo character is a
// skinned mesh over a 65-joint rig. This module makes the second wear the
// first's solution: the ATD skeleton is REBUILT WITH THE CHARACTER'S OWN
// PROPORTIONS (joint offsets read off the rig's reference pose, so the hands
// really land where the character's hands are), the crew layer poses and IK-
// solves it exactly as before, and `dress` copies each solved bone's world
// orientation onto the matching Mixamo joint — every unmapped joint (Spine2,
// fingers, toes, the head top) rides rigidly with its nearest mapped
// ancestor. The mesh follows through ordinary GPU skinning.
//
// Conventions that meet here:
//   ATD    rest = identity everywhere, standing, arms hanging, +x the pilot's
//          left, +y up, +z forward; a limb bone's local -y runs down the
//          segment; a HAND's +x is the grip axis (thumb side), -y the fingers,
//          +-z the palm (gripQuat in _cage_crew.js).
//   Mixamo rest = T-pose (or A-pose) facing +z, left = +x, in centimetres
//          under an armature root that scales to metres and turns y up. A
//          hand's bone axis runs to the fingers, palm faces the body, thumb
//          forward (+z world) when the arm is brought down to hang.
// The REFERENCE POSE is the rig's rest with each upper arm rotated by the
// shortest arc onto straight down — that pose IS the ATD identity, so the
// transfer is: joint.worldQ = atdBone.worldQ * C * joint.refWorldQ, with C
// the identity except on hands, where a fixed 90 deg about the hand's own
// length turns "palm to the body" into "palm across the grip".
//
// Loads AFTER 52_char_codec.js (CHAR_REG, decodeChar) and the character
// manifests, BEFORE _cage_crew.js. Node-free: THREE scenery only.
'use strict';
(() => {
const D2R = Math.PI / 180;
const REG = () => (typeof CHAR_REG !== 'undefined' ? CHAR_REG
                   : (window.CHAR_REG || { chars: {}, order: [] }));

// ATD bone -> Mixamo joint (base name; the "mixamorig:" prefix is stripped)
const MAP = {
  root: 'Hips', lumbar: 'Spine', thorax: 'Spine1', neck: 'Neck', head: 'Head',
  clavicleL: 'LeftShoulder', shoulderL: 'LeftArm', elbowL: 'LeftForeArm',
  wristL: 'LeftHand', clavicleR: 'RightShoulder', shoulderR: 'RightArm',
  elbowR: 'RightForeArm', wristR: 'RightHand',
  hipL: 'LeftUpLeg', kneeL: 'LeftLeg', ankleL: 'LeftFoot',
  hipR: 'RightUpLeg', kneeR: 'RightLeg', ankleR: 'RightFoot',
};
// the ATD's own parent table (the order _cage_crew.js's BONES uses)
const ATD_PARENT = {
  root: null, lumbar: 'root', thorax: 'lumbar', neck: 'thorax', head: 'neck',
  clavicleL: 'thorax', shoulderL: 'clavicleL', elbowL: 'shoulderL',
  wristL: 'elbowL', clavicleR: 'thorax', shoulderR: 'clavicleR',
  elbowR: 'shoulderR', wristR: 'elbowR', hipL: 'root', kneeL: 'hipL',
  ankleL: 'kneeL', hipR: 'root', kneeR: 'hipR', ankleR: 'kneeR',
};
const ATD_ORDER = ['root', 'lumbar', 'thorax', 'neck', 'head', 'clavicleL',
  'shoulderL', 'elbowL', 'wristL', 'clavicleR', 'shoulderR', 'elbowR',
  'wristR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];
const HAND_C = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0), Math.PI / 2);
const base = n => n.replace(/^.*:/, '');

// ---- the node tree, verbatim from the manifest ---------------------------
// joints become THREE.Bone (a Skeleton wants them), everything else Object3D.
function buildTree(c) {
  const isJoint = new Set(c.joints);
  const objs = c.nodes.map((n, i) => {
    const o = isJoint.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.n;
    o.position.fromArray(n.t);
    o.quaternion.fromArray(n.r);
    o.scale.fromArray(n.s);
    return o;
  });
  c.nodes.forEach((n, i) => { if (n.p >= 0) objs[n.p].add(objs[i]); });
  const root = new THREE.Group();
  root.name = 'char:' + c.key;
  for (const i of c.scene) root.add(objs[i]);
  const byBase = {};
  objs.forEach(o => { byBase[base(o.name)] = o; });
  root.updateMatrixWorld(true);
  return { root, objs, byBase };
}

// bring an upper arm from its rest (T/A-pose) onto straight down: the
// shortest arc, applied in the tree's own frame; children inherit
function hangArm(t, side) {
  const arm = t.byBase[side + 'Arm'], fore = t.byBase[side + 'ForeArm'];
  if (!arm || !fore) return;
  const a = arm.getWorldPosition(new THREE.Vector3());
  const f = fore.getWorldPosition(new THREE.Vector3());
  const dir = f.sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, -1, 0));
  const w = arm.getWorldQuaternion(new THREE.Quaternion());
  const pw = arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  arm.quaternion.copy(pw.multiply(q.multiply(w)));
  t.root.updateMatrixWorld(true);
}

// ---- THE RIG: what the crew layer needs to build its ATD skeleton ---------
// Computed from the manifest alone (no bin, no textures), so the dummy's
// proportions are right from the first build even while the mesh is still on
// the wire. Cached per key.
const RIGS = {};
function rig(key) {
  if (RIGS[key]) return RIGS[key];
  const c = REG().chars[key];
  if (!c) return null;
  const t = buildTree(c);
  // the T-POSE world quaternions, before the arms come down: the frame the
  // finger curl axes are known in (fingers along +-x, palms down, so a
  // finger flexes about world z and a thumb about world x)
  const restQ = t.objs.map(o => o.getWorldQuaternion(new THREE.Quaternion()));
  const restLocal = t.objs.map(o => o.quaternion.clone());
  const curl = [];
  t.objs.forEach((o, i) => {
    const m = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)([123])$/.exec(base(o.name));
    if (!m) return;
    const k = +m[3] - 1, thumb = m[2] === 'Thumb';
    // degrees of flexion at a CLOSED fist, per phalanx
    const ang = (thumb ? [10, 35, 40] : [70, 90, 60])[k] * D2R;
    const sign = thumb ? 1 : (m[1] === 'Left' ? -1 : 1);
    const axisW = thumb ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const axis = axisW.applyQuaternion(restQ[i].clone().invert()).normalize();
    curl.push({ i, axis, ang: ang * sign });
  });
  hangArm(t, 'Left'); hangArm(t, 'Right');
  const wp = {};
  for (const k in MAP) {
    const o = t.byBase[MAP[k]];
    if (!o) throw new Error('char ' + key + ': no joint for ' + k + ' (' + MAP[k] + ')');
    wp[k] = o.getWorldPosition(new THREE.Vector3());
  }
  const bones = ATD_ORDER.map(k => {
    const p = ATD_PARENT[k];
    const d = p ? wp[k].clone().sub(wp[p]) : new THREE.Vector3();
    return [k, p, [+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)]];
  });
  // standing height: the highest joint (HeadTop_End) over the lowest (a toe)
  let yMin = Infinity, yMax = -Infinity;
  t.objs.forEach(o => { const y = o.getWorldPosition(new THREE.Vector3()).y;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y; });
  // the reference world quaternion of EVERY node, in the tree's frame
  const refQ = t.objs.map(o => o.getWorldQuaternion(new THREE.Quaternion()));
  return (RIGS[key] = { key, bones, height: yMax - yMin,
    hipsOff: wp.root.clone(),                 // Hips in the tree's frame
    hipDrop: wp.root.y - wp.hipL.y,           // pelvis centre above hip joints
    refQ, restLocal, curl,
    byBase: (() => { const m = {}; t.objs.forEach((o, i) => { m[base(o.name)] = i; }); return m; })() });
}

// ---- LOAD: the bin through the page's one fetch ---------------------------
const DEC = {}, LOADING = {}, FAILED = {};
function ready(key) { return DEC[key] || null; }
// A FAILED FETCH IS NOT REMEMBERED (G210.1, the user: 'selecting any mixamo
// figures gives me back the original mannequin'). The first cut cached the
// failed promise for the page's life, and ASSET_FETCH caches a rejection by
// URL on purpose — so one dropped connection while a mixed crew pulled
// 300 MB of textures (the dev servers drop connections under load) left
// that character a mannequin until a reload. Now a failure is forgotten,
// the next build tries again, and the retry goes round ASSET_FETCH's cached
// rejection with a plain fetch.
function fetchBytes(url, plain) {
  if (!plain && typeof window.ASSET_FETCH === 'function') return window.ASSET_FETCH(url);
  return fetch(url).then(r => { if (!r.ok) throw new Error(url + ' -> ' + r.status);
                                return r.arrayBuffer(); }).then(b => new Uint8Array(b));
}
function load(key) {
  if (DEC[key]) return Promise.resolve(DEC[key]);
  const c = REG().chars[key];
  if (!c) return Promise.resolve(null);
  if (LOADING[key]) return LOADING[key];
  return (LOADING[key] = fetchBytes(c.bin, !!FAILED[key])
    .then(buf => { FAILED[key] = 0; return (DEC[key] = decodeChar(c, buf)); })
    .catch(e => {
      console.warn('char ' + key + ' failed to load (will retry on the next build):',
                   e && e.message);
      FAILED[key] = (FAILED[key] | 0) + 1;
      return null;
    })
    .finally(() => { if (!DEC[key]) delete LOADING[key]; }));
}

// ---- textures + materials -------------------------------------------------
const TEX = {};
function texture(c, id, srgb) {
  const k = c.key + '/' + id + (srgb ? '/s' : '/l');
  if (TEX[k]) return TEX[k];
  const uri = c.texs[id];
  if (!uri) return null;
  const img = new Image();
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false;                            // glTF uv origin is top-left
  t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  const ok = () => { t.needsUpdate = true; if (window.CHAR_TEX_LANDED) window.CHAR_TEX_LANDED(c.key); };
  img.onload = ok;
  img.src = uri;
  return (TEX[k] = t);
}
const MATS = {};
function material(c, mi) {
  const k = c.key + '/' + mi;
  if (MATS[k]) return MATS[k];
  const m = c.mats[mi] || {};
  // Mixamo's "nonPBR" set is diffuse + normal + spec/gloss; the gloss map is
  // NOT a roughness map (it is its inverse), so roughness stays a scalar.
  const o = {
    color: new THREE.Color(m.col ? m.col[0] : 1, m.col ? m.col[1] : 1, m.col ? m.col[2] : 1),
    roughness: 0.62, metalness: 0,
    side: m.ds ? THREE.DoubleSide : THREE.FrontSide,
    skinning: true,
  };
  if (m.map) o.map = texture(c, m.map, true);
  if (m.nrm) o.normalMap = texture(c, m.nrm, false);
  // BLEND IS A CUTOUT, NOT A TRANSPARENT (G205.1, the user: 'sometimes it is
  // drawn behind the glass, sometimes in front depending on the angle').
  // three sorts transparents by OBJECT position, and a skinned mesh's
  // position is its armature origin — a metre under the floor — so hair
  // (and Ch01's whole BLEND-flagged body) sorted against the canopy glass
  // by a point that is nowhere near the head, and won or lost with the
  // camera. Drawn opaque with an alpha test they depth-test like the rest of
  // the body, and the glass, drawn after, composes over them correctly.
  // (G204.2's depthWrite fix — back faces through the face — is subsumed.)
  if (m.blend === 'BLEND' || m.blend === 'MASK') o.alphaTest = 0.5;
  const mat = new THREE.MeshStandardMaterial(o);
  mat.name = 'char:' + c.key + ':' + (m.name || mi);
  mat.userData.charSkin = 1;                 // the editor's passes leave it be
  // WHICH PERSON AND WHICH OF THEIR MATERIALS (G210.2): the join carries
  // these two across so the flown aeroplane rebuilds the person from this
  // same factory — the contract AEROSKIN's `fin` and the vessels' `ves`
  // already have. Without it a character flew as a bare colour.
  mat.userData.charKey = c.key;
  mat.userData.charMat = mi;
  // A PERSON SITS IN THE CABIN (G206.1): the same darkness the liners and
  // the seats take, through AEROSKIN's small hook for materials that are not
  // its own. aeroskin.js loads after tools/* in the bundle, and this runs at
  // build time, so it is there; a page without it keeps a lit crew.
  if (typeof window !== 'undefined' && window.AEROSKIN &&
      window.AEROSKIN.aeroCabinHook)
    window.AEROSKIN.aeroCabinHook(THREE, mat, 1);
  return (MATS[k] = mat);
}

// ---- INSTANCE: a posable copy of the character ---------------------------
// Geometry buffers are shared across instances (two pilots = one upload);
// the tree, skeleton and skinned meshes are per instance.
const GEOS = {};
function geometries(c, dec) {
  if (GEOS[c.key]) return GEOS[c.key];
  return (GEOS[c.key] = dec.meshes.map(m => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(m.jt), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(m.wt, 4));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeBoundingSphere();
    return g;
  }));
}
function instance(key) {
  const c = REG().chars[key], dec = DEC[key];
  if (!c || !dec) return null;
  const t = buildTree(c);
  const bones = c.joints.map(i => t.objs[i]);
  const inv = [];
  for (let i = 0; i < bones.length; i++)
    inv.push(new THREE.Matrix4().fromArray(dec.ibm, 16 * i));
  const skeleton = new THREE.Skeleton(bones, inv);
  const geos = geometries(c, dec);
  const meshes = dec.meshes.map((m, i) => {
    const sm = new THREE.SkinnedMesh(geos[i], material(c, m.mat));
    sm.name = 'char:' + c.key + ':' + m.name;
    sm.frustumCulled = false;                 // the sphere is the rest pose's
    // NOT PICKABLE (G204.2): r128 raycasts a SkinnedMesh at its BIND pose —
    // a T-pose under the floor — so a click there selected the crew and the
    // highlight drew that ghost ('the 4 little dots at the bottom'). The
    // crew layer's invisible ATD shells, which follow the pose, take the
    // clicks and the silhouette instead.
    sm.raycast = () => {};
    const node = t.objs[m.node];
    node.add(sm);
    // BIND WITH THE IDENTITY, NOT THE NODE'S WORLD MATRIX. glTF: 'the
    // transform of the skinned mesh node MUST be ignored' — the vertices
    // are in scene space (Blender writes them so; radius ~1 m, not 100 cm)
    // and the inverse bind matrices already carry the armature's 0.01 x90deg.
    // Binding with matrixWorld (= the armature) applied that transform
    // twice: the body shrank to a centimetre and its faces streaked to the
    // armature origin under the floor (the user's 'distorted polygons').
    sm.bind(skeleton, new THREE.Matrix4());
    return sm;
  });
  return { key, c, tree: t, skeleton, meshes, rig: rig(key) };
}

// ---- DRESS: the solved ATD skeleton -> the character's joints -------------
// `dum` is _cage_crew.js's { fig, bones }; the instance root is parented under
// fig (which carries the stature scale and no rotation) with the Hips on the
// fig origin. Orientations are transferred in the FIG's frame, so a rotated
// mount (the game's sit transform) is a no-op here as it is for the IK.
const _fq = new THREE.Quaternion(), _q = new THREE.Quaternion(),
      _p = new THREE.Quaternion();
function dress(inst, dum, opts) {
  const { tree: t, rig: R } = inst;
  opts = opts || {};
  if (t.root.parent !== dum.fig) {
    dum.fig.add(t.root);
    t.root.position.copy(R.hipsOff).negate();
  }
  // WHOSE ORIENTATIONS (live crew): `opts.from` is a skeleton with the same
  // bones in the same fig frame to READ from — the flown pilot's solver twin,
  // which lives in an orthonormal frame where the aeroplane's drawn group is
  // sheared (app.js buildPeople), so the world quaternions decomposed here
  // are exact. The tree stays under `dum.fig`, where it is drawn.
  const src = opts.from || dum;
  src.fig.updateWorldMatrix(true, false);
  src.fig.getWorldQuaternion(_fq).invert();
  // ATD bone world -> fig frame, once per mapped bone
  const atdQ = {};
  for (const k in MAP) {
    const b = src.bones[k];
    if (!b) continue;
    atdQ[MAP[k]] = _fq.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
  }
  // depth-first from the tree root: each node takes its nearest mapped
  // ancestor's delta; parent world quaternions accumulate in the fig frame
  const visit = (o, parentQ, delta) => {
    const i = t.objs.indexOf(o);
    let d = delta;
    if (i >= 0) {
      const nm = base(o.name);
      if (atdQ[nm]) {
        d = atdQ[nm].clone();
        if (nm === 'LeftHand' || nm === 'RightHand') d.multiply(HAND_C);
      }
      if (d) {
        // target world (fig frame) = delta * refQ; local = parent^-1 * target
        _q.copy(d).multiply(R.refQ[i]);
        o.quaternion.copy(_p.copy(parentQ).invert().multiply(_q));
      }
    }
    _q.copy(parentQ).multiply(o.quaternion);
    const myQ = _q.clone();
    for (const ch of o.children) if (!ch.isSkinnedMesh) visit(ch, myQ, d);
  };
  visit(t.root, new THREE.Quaternion(), null);
  // THE FIST (G205, the user: 'close the fist halfway'): every phalanx flexes
  // about its own curl axis by its share of a closed fist times `fist`; the
  // next phalanx is a child, so the chain closes on itself for free.
  const fist = opts.fist == null ? 0.5 : opts.fist;
  for (const cu of R.curl) {
    const o = t.objs[cu.i];
    o.quaternion.copy(R.restLocal[cu.i])
      .multiply(_q.setFromAxisAngle(cu.axis, cu.ang * fist));
  }
  t.root.updateMatrixWorld(true);
  // the POSED locals: what the animator moves around (G205)
  inst.baseQ = t.objs.map(o => o.quaternion.clone());
}

// WHERE THE FIST CLOSES (G279): the world centroid of the four fingers'
// middle phalanges — the hollow a grip sits in once the fingers curl. The
// crew layer aims its grips at THIS, not at the wrist: the rig's hand is
// its own length, offset from the ATD's wrist by its own arm's proportions,
// and the two differed by 5 cm along the stick on one hand and by nothing
// on the other. Read after dress().
const _fp = new THREE.Vector3();
function fistAt(inst, side, out) {
  const t = inst.tree, S = side === 'L' ? 'Left' : 'Right';
  out = out || new THREE.Vector3();
  out.set(0, 0, 0);
  let n = 0;
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
    const o = t.byBase[S + 'Hand' + f + '2'];
    if (!o) continue;
    out.add(o.getWorldPosition(_fp)); n++;
  }
  return n ? out.multiplyScalar(1 / n) : null;
}

// dispose the per-instance objects (geometries and materials are shared and
// stay for the page's life)
function dispose(inst) {
  if (inst && inst.tree.root.parent) inst.tree.root.parent.remove(inst.tree.root);
}

// ---- THE CLIPS (G205) -----------------------------------------------------
// A Mixamo clip retargets by JOINT NAME: same rig, same joint frames, so a
// sampled local rotation is the same rotation on every character. Two ways
// to wear one, both layered OVER the solved pose (the ATD keeps the root,
// the legs, and for a pilot the arms — the user: 'we need to keep being
// able to edit the position ourselves'):
//   'body'  the clip's DEVIATION from its own MEAN pose, scaled by `amp`,
//           on the whole upper body (spine, neck, head, shoulders, arms,
//           hands, fingers) — the passenger's idle as MOTION over the
//           solved pose, so the hands the IK rested on the knees stay
//           there and the recline slider still rules (G205.2; the first
//           cut took the clip's arms absolutely, and they went through the
//           thighs the moment the feet sliders lifted the knees);
//   'head'  the clip's DEVIATION from its own MEAN pose, scaled by `amp`,
//           on neck and head (full), Spine2 (0.6) and Spine1 (0.3) — a
//           pilot who breathes and looks about while the hands stay on the
//           controls the IK put them on.
const ANIMS = () => (typeof CHAR_ANIMS !== 'undefined' ? CHAR_ANIMS
                     : (window.CHAR_ANIMS || { anims: {}, order: [] }));
const ADEC = {}, ALOAD = {}, AFAILED = {};
function animLoad(key) {
  if (ADEC[key]) return Promise.resolve(ADEC[key]);
  const a = ANIMS().anims[key];
  if (!a) return Promise.resolve(null);
  if (ALOAD[key]) return ALOAD[key];
  const fetchBin = fetchBytes(a.bin, !!AFAILED[key]);   // same forgetting rule as load()
  return (ALOAD[key] = fetchBin.then(buf => {
    a._ji = {}; a.joints.forEach((n, i) => { a._ji[n] = i; });
    const dec = decodeCharAnim(a, buf);
    // THE REFERENCE IS THE MEAN, NOT FRAME 0 (G205.2): a clip's first frame
    // is whatever the animator started from, and a deviation measured from
    // it can be an arm's whole travel — the passengers' hands left their
    // knees for their cheeks. The per-joint mean orientation over the clip
    // is the pose the motion happens AROUND, so the deviation is the motion.
    const nj = a.joints.length, mean = new Float32Array(nj * 4);
    for (let ji = 0; ji < nj; ji++) {
      let sx = 0, sy = 0, sz = 0, sw = 0;
      const r = ji * 4;
      for (let f = 0; f < a.frames; f++) {
        const o = (f * nj + ji) * 4;
        // hemisphere-align to the first sample before summing
        const d = dec[o] * dec[r] + dec[o + 1] * dec[r + 1] + dec[o + 2] * dec[r + 2] + dec[o + 3] * dec[r + 3];
        const sg = d < 0 ? -1 : 1;
        sx += sg * dec[o]; sy += sg * dec[o + 1]; sz += sg * dec[o + 2]; sw += sg * dec[o + 3];
      }
      const n = Math.hypot(sx, sy, sz, sw) || 1;
      mean[r] = sx / n; mean[r + 1] = sy / n; mean[r + 2] = sz / n; mean[r + 3] = sw / n;
    }
    a._mean = mean;
    return (ADEC[key] = dec);
  }).catch(e => { console.warn('clip ' + key + ' failed to load (will retry):', e && e.message);
                  AFAILED[key] = (AFAILED[key] | 0) + 1;
                  return null; })
    .finally(() => { if (!ADEC[key]) delete ALOAD[key]; }));
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(),
      _qd = new THREE.Quaternion(), _qm = new THREE.Quaternion();
// _qa/_qb are animSample's own scratch — the caller must not hold anything
// in them across the call (the first cut did, and the 'deviation' became
// the frame's rotation applied twice: hands 0.66 m off their knees)
// the clip's local rotation of joint `ji` at time t (seconds, wrapped)
function animSample(a, dec, ji, t, out) {
  const nj = a.joints.length;
  let f = (t % a.dur) * a.fps;
  if (f < 0) f += (a.frames - 1);
  const f0 = Math.floor(f), f1 = Math.min(f0 + 1, a.frames - 1), u = f - f0;
  _qa.fromArray(dec, (f0 * nj + ji) * 4);
  _qb.fromArray(dec, (f1 * nj + ji) * 4);
  return out.copy(_qa).slerp(_qb, u);
}
const BODY_SET = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
const HEAD_SET = { Neck: 1, Head: 1, Spine2: 0.6, Spine1: 0.3 };
const LIVE = new Set();
let ticking = false;
// spec = { key, mode: 'body'|'head', amp, phase }
function animate(inst, spec) {
  if (!spec || !spec.key || !(spec.amp > 0)) return;
  inst.anim = spec;
  LIVE.add(inst);
  animLoad(spec.key);
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
}
function clearAnims() { LIVE.clear(); }
// ONE INSTANCE, ONE MOMENT (live crew): the clip's deviation from its mean,
// layered over `baseQ` — what `tick` does for the editor's LIVE set on rAF,
// and what the flown pilot's loop calls synchronously AFTER its IK and
// dress, so the order (solve, transfer, breathe) is the loop's and not the
// scheduler's. `spec` overrides inst.anim; returns whether anything moved.
function animStep(inst, now, spec) {
  const sp = spec || inst.anim;
  if (!sp) return false;
  const a = ANIMS().anims[sp.key], dec = ADEC[sp.key];
  if (!a || !dec || !inst.baseQ) { if (a && !dec) animLoad(sp.key); return false; }
  const t = now + (sp.phase || 0);
  const R = inst.rig, objs = inst.tree.objs;
  if (sp.mode === 'body') {
    const names = BODY_SET.concat(a.joints.filter(n => /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n)));
    for (const n of names) {
      const i = R.byBase[n], ji = a._ji[n];
      if (i == null || ji == null) continue;
      _qm.fromArray(a._mean, ji * 4).invert();
      animSample(a, dec, ji, t, _qd).premultiply(_qm);
      _qb.identity().slerp(_qd, sp.amp);
      objs[i].quaternion.copy(inst.baseQ[i]).multiply(_qb);
    }
  } else {
    for (const n in HEAD_SET) {
      const i = R.byBase[n], ji = a._ji[n];
      if (i == null || ji == null) continue;
      // deviation from the clip's mean pose, in the joint's own frame
      _qm.fromArray(a._mean, ji * 4).invert();
      animSample(a, dec, ji, t, _qd).premultiply(_qm);
      _qb.identity().slerp(_qd, sp.amp * HEAD_SET[n]);
      objs[i].quaternion.copy(inst.baseQ[i]).multiply(_qb);
    }
  }
  return true;
}
function tick() {
  if (!LIVE.size) { ticking = false; return; }
  requestAnimationFrame(tick);
  const now = performance.now() / 1000;
  let moved = false;
  for (const inst of LIVE) if (animStep(inst, now)) moved = true;
  // the game's loop renders every frame; the standalone bench draws on demand
  if (moved && !window.CAGE_IN_GAME && window.CAGE_UI && window.CAGE_UI.draw)
    window.CAGE_UI.draw();
}

// THE SAME MATERIAL, FOR A MESH THAT IS NO LONGER SKINNED (G210.2). The
// flight snapshot bakes the character POSED, into a plain BufferGeometry, so
// what dresses it there is this material with `skinning` off — same maps,
// same cutout, same cabin darkness. Cached per (character, material).
const FLAT = {};
function flatMaterial(key, mi) {
  const k = key + '/' + mi;
  if (FLAT[k]) return FLAT[k];
  const c = REG().chars[key];
  if (!c || !c.mats || !c.mats[mi]) return null;
  const m = material(c, mi).clone();
  m.skinning = false;
  m.userData = Object.assign({}, m.userData);
  m.needsUpdate = true;
  return (FLAT[k] = m);
}

window.CAGE_CHAR = { MAP, list: () => REG().order.map(k => REG().chars[k]),
  rig, load, ready, instance, dress, dispose, flatMaterial, fistAt,
  animLoad, animate, animStep, clearAnims, anims: () => ANIMS().order.slice() };
})();
