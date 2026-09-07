// char_codec.js — decode baked RIGGED CHARACTER payloads (see tools/char_prep.py).
// Pure JS, no three.js: the same code runs in the page and in the node gates.
//
// WHY A THIRD CODEC. 50_model_codec.js bakes an aeroplane (one quantised box,
// no normals), 51_prop_codec.js a rigid prop (per-part quantisation, author's
// normals). A character is neither: it is a SKINNED mesh — every vertex
// carries four joint indices and four weights, and the payload has to carry
// the joint tree and the inverse bind matrices the skin was authored against,
// or the mesh cannot be posed at all. Positions ride as float32 exactly as the
// exporter wrote them (import-models-as-is): a mannequin is 1.8 m tall and
// quantising it buys nothing worth a second encoding.
//
// Layout (little-endian, sections 4-byte aligned; the manifest carries every
// offset and count, nothing is discovered by reading ahead):
//   ibm      f32[16 * nJoints]  inverse bind matrices, column-major, in the
//                               order of manifest.joints (node indices)
//   per mesh at manifest.meshes[i].off:
//            f32 pos[3n] f32 nrm[3n] f32 uv[2n] u8 jt[4n] f32 wt[4n] u16 idx[3t]
//
// The manifest's `nodes` is the GLB's whole node tree verbatim ({n name,
// p parent index or -1, t, r, s}) — joints AND the mesh nodes AND the armature
// root, because a skin's bind pose is only right under the very tree it was
// exported with. `scene` lists the roots. The consumer (tools/_cage_char.js)
// rebuilds the tree as Object3Ds, binds each mesh to the skeleton and then
// drives the joints from the crew layer's IK solution.

const CHAR_REG = { chars: {}, order: [] };

// A manifest registers itself at load (src/chars/<key>_char.js); table order
// is load order is chars_index.json order. The ONE list the editor's "pilot
// model" select, the crew layer and GATE MEDIA read.
function registerChar(c) {
  if (!CHAR_REG.chars[c.key]) CHAR_REG.order.push(c.key);
  CHAR_REG.chars[c.key] = c;
  return CHAR_REG;
}
function charList() { return CHAR_REG.order.map(k => CHAR_REG.chars[k]); }

// bin -> { ibm: Float32Array(16*nJ), meshes: [{pos,nrm,uv,jt,wt,idx,mat,name,node}] }
// Typed arrays are views over a 4-aligned copy when the incoming buffer is not
// aligned (fetch gives a fresh ArrayBuffer at 0, fs may not).
function decodeChar(c, bin) {
  if (!bin) throw new Error('decodeChar: "' + c.key + '" needs its bin bytes');
  let u8 = bin;
  if (u8.byteOffset % 4) u8 = new Uint8Array(u8);
  const B = u8.buffer, o0 = u8.byteOffset;
  const nJ = c.joints.length;
  const ibm = new Float32Array(B, o0, 16 * nJ);
  const meshes = c.meshes.map(m => {
    let o = o0 + m.off;
    const n = m.nv, t = m.nt;
    const pos = new Float32Array(B, o, 3 * n); o += 12 * n;
    const nrm = new Float32Array(B, o, 3 * n); o += 12 * n;
    const uv = new Float32Array(B, o, 2 * n); o += 8 * n;
    const jt = new Uint8Array(B, o, 4 * n); o += 4 * n;
    const wt = new Float32Array(B, o, 4 * n); o += 16 * n;
    const idx = new Uint16Array(B, o, 3 * t); o += 6 * t;
    if (o - (o0 + m.off) > m.len)
      throw new Error('decodeChar: mesh "' + m.name + '" overruns its slice');
    return { name: m.name, node: m.node, mat: m.mat, nv: n, nt: t,
             pos, nrm, uv, jt, wt, idx };
  });
  return { ibm, meshes };
}

// ---- THE CLIPS (G205) -----------------------------------------------------
// A clip is sampled joint rotations on a uniform grid: f32 [frames][joints]
// [4], joints named by their Mixamo base name so the same clip drives every
// character. decodeCharAnim hands back the flat array; the sampler lives
// with THREE in tools/_cage_char.js.
const CHAR_ANIMS = { anims: {}, order: [] };
function registerCharAnim(a) {
  if (!CHAR_ANIMS.anims[a.key]) CHAR_ANIMS.order.push(a.key);
  CHAR_ANIMS.anims[a.key] = a;
  return CHAR_ANIMS;
}
function decodeCharAnim(a, bin) {
  if (!bin) throw new Error('decodeCharAnim: "' + a.key + '" needs its bin bytes');
  let u8 = bin;
  if (u8.byteOffset % 4) u8 = new Uint8Array(u8);
  const n = a.frames * a.joints.length * 4;
  if (u8.byteLength < n * 4)
    throw new Error('decodeCharAnim: "' + a.key + '" bin is short');
  return new Float32Array(u8.buffer, u8.byteOffset, n);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { decodeChar, registerChar, charList, CHAR_REG,
                     decodeCharAnim, registerCharAnim, CHAR_ANIMS };
