// animal_codec.js — decode baked ANIMAL payloads (see tools/animal_prep.py).
// Pure JS, no three.js: the same code runs in the page and in the node gates.
//
// WHY A FOURTH CODEC. 50_model_codec.js bakes an aeroplane, 51_prop_codec.js a
// rigid prop, 52_char_codec.js a rigged CHARACTER — and that last one is
// nearly this, which is why it was read line by line before this was written.
// Three things it cannot carry, each of them load-bearing here:
//
//   A CLIP WITH TRANSLATIONS. char_prep keeps rotation channels only, on
//   purpose: the ATD owns a seated pilot's root and a translation would fight
//   the seat. An animal's clip IS the whole animal — 34 of a bear's 76
//   channels are translations, and its root walks the rig forward.
//   A CLIP LIBRARY. A character wears one of two clips. A bear ships 81 and
//   chains them; the manifest carries every clip the table asked for, by ROLE.
//   A RIGID CHILD. The elk's antlers are a plain mesh under a bone — no joint
//   indices, no weights. `mesh.skin === 0` says so and the factory parents it.
//
// Layout (little-endian, sections 4-byte aligned; the manifest carries every
// offset and count, nothing is discovered by reading ahead):
//   ibm      f32[16 * nJoints]   inverse bind matrices, column-major (glTF)
//   per mesh at manifest.meshes[i].off:
//     f32 pos[3n] f32 nrm[3n] f32 uv[2n] [u8 jt[4n] f32 wt[4n]] u16 idx[3t]
//
// The clips ride in a SECOND file (manifest.clipBin), per clip at clip.off:
//   f32 travel[3 * frames]                  the root's displacement, METRES,
//                                           in the model frame, y up
//   per frame: f32 t[3] per node of clip.nt
//              f32 r[4] per node of clip.nr
//              f32 s[3] per node of clip.ns
// A node not in a list keeps its rest TRS, which is why a clip that animates
// a third of the tree costs a third of the bytes.
//
// NOTHING IS SCALED IN THE PAYLOAD. `manifest.scale` is the factor from the
// delivered units to the declared real length, and the SCENE applies it (one
// Object3D scale at the root). `dim`, `bb` and every clip's `travel`/`speed`
// are already in METRES — they are measurements, not geometry.

const ANIMAL_REG = { animals: {}, order: [] };

// A manifest registers itself at load (src/animals/<key>_animal.js); table
// order is load order is animals_index.json order. The ONE list the editor's
// palette, the behaviours and GATE MEDIA read.
function registerAnimal(a) {
  if (!ANIMAL_REG.animals[a.key]) ANIMAL_REG.order.push(a.key);
  ANIMAL_REG.animals[a.key] = a;
  return ANIMAL_REG;
}
function animalList(kind) {
  return ANIMAL_REG.order.map(k => ANIMAL_REG.animals[k]).filter(a => !kind || a.kind === kind);
}
// every clip of a role, in manifest order; [] when the row never filled it
function animalClips(a, role) {
  return (a && a.clips ? a.clips : []).filter(c => c.role === role);
}
// the one clip a role resolves to, falling back down a chain of roles — the
// ONE place "what does this animal do when it has no `lie`" is answered
const ROLE_FALLBACK = { browse: 'idle', trot: 'walk', rear: 'idle', lie: 'idle',
                        toWalk: null, toLie: null, fromLie: null, turnL: null, turnR: null,
                        walk: 'idle', swim: 'idle', flap: 'idle' };
function animalClip(a, role, pick) {
  let r = role, seen = 0;
  while (r && seen++ < 6) {
    const got = animalClips(a, r);
    if (got.length) return got[Math.min(got.length - 1, Math.floor((pick || 0) * got.length))];
    r = ROLE_FALLBACK[r];
  }
  return null;
}

// bin -> { ibm: Float32Array(16*nJ), meshes: [{pos,nrm,uv,jt,wt,idx,mat,name,node,skin}] }
// Typed arrays are views over a 4-aligned copy when the incoming buffer is not
// aligned (fetch gives a fresh ArrayBuffer at 0, fs may not).
function decodeAnimal(a, bin) {
  if (!bin) throw new Error('decodeAnimal: "' + a.key + '" needs its bin bytes');
  let u8 = bin;
  if (u8.byteOffset % 4) u8 = new Uint8Array(u8);
  const B = u8.buffer, o0 = u8.byteOffset;
  const nJ = a.joints.length;
  const ibm = new Float32Array(B, o0, 16 * nJ);
  const meshes = a.meshes.map(m => {
    let o = o0 + m.off;
    const n = m.nv, t = m.nt;
    const pos = new Float32Array(B, o, 3 * n); o += 12 * n;
    const nrm = new Float32Array(B, o, 3 * n); o += 12 * n;
    const uv = new Float32Array(B, o, 2 * n); o += 8 * n;
    let jt = null, wt = null;
    if (m.skin) {
      jt = new Uint8Array(B, o, 4 * n); o += 4 * n;
      wt = new Float32Array(B, o, 4 * n); o += 16 * n;
    }
    const idx = new Uint16Array(B, o, 3 * t); o += 6 * t;
    if (o - (o0 + m.off) > m.len)
      throw new Error('decodeAnimal: mesh "' + m.name + '" overruns its slice');
    return { name: m.name, node: m.node, mat: m.mat, skin: !!m.skin, nv: n, nt: t,
             pos, nrm, uv, jt, wt, idx };
  });
  return { ibm, meshes };
}

// the clip file -> one view per clip: { travel, frames, stride, data } where
// `data` is the frames slab and `stride` the floats a frame. The SAMPLER lives
// with THREE in src/viewer/animals.js; this hands back the numbers.
function decodeAnimalClips(a, bin) {
  if (!bin) throw new Error('decodeAnimalClips: "' + a.key + '" needs its clip bytes');
  let u8 = bin;
  if (u8.byteOffset % 4) u8 = new Uint8Array(u8);
  const B = u8.buffer, o0 = u8.byteOffset;
  const out = {};
  for (const c of a.clips) {
    const stride = 3 * c.nt.length + 4 * c.nr.length + 3 * c.ns.length;
    const travel = new Float32Array(B, o0 + c.off, 3 * c.frames);
    const data = new Float32Array(B, o0 + c.off + 12 * c.frames, stride * c.frames);
    if (12 * c.frames + 4 * stride * c.frames > c.len)
      throw new Error('decodeAnimalClips: clip "' + c.key + '" overruns its slice');
    out[c.key] = { key: c.key, role: c.role, name: c.name, fps: c.fps, frames: c.frames,
                   dur: c.dur, speed: c.speed, travelLen: c.travel, dir: c.dir,
                   nt: c.nt, nr: c.nr, ns: c.ns, stride, travel, data };
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { decodeAnimal, decodeAnimalClips, registerAnimal, animalList,
                     animalClips, animalClip, ROLE_FALLBACK, ANIMAL_REG };
