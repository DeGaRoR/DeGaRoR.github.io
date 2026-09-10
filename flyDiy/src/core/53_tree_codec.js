// tree_codec.js — decode baked TREE payloads (see tools/tree_prep.py).
// Pure JS, no three.js: the same code runs in the viewer and in the node gate.
//
// WHY A THIRD CODEC. 50_model_codec.js bakes an AEROPLANE (one bb for the whole
// model, no normals, a skin binding); 51_prop_codec.js bakes dozens of small
// rigid objects, each with the author's normals and its own uv range. A tree is
// the prop case plus two things neither has:
//
//   AN AO CHANNEL. One byte per vertex, and it is not decoration. The
//   screen-space pass it replaces was reading depth and guessing — at the
//   horizon a pixel's neighbours are metres apart, and it returned a field of
//   black specks — and it could never reach the impostor bake, which is
//   exactly where a tree's own shading has to be right. Occlusion is a
//   property of the tree, so it travels with the tree. Bark carries a
//   foot-to-crown gradient in the same channel: a trunk stands at the bottom
//   of its own canopy's shadow and nothing else in the shading knows that.
//
//   RUNGS. A subject is a LADDER, not a mesh. Where a pack ships its own LOD
//   chain the payload keeps the author's rungs (LOLIPOP ships 12969 / 6633 /
//   3268 / 20); where it does not, there is one rung and the ladder is built
//   at load. Every rung of a subject quantises over the SAME box — the union
//   of all of them, because a coarser rung is not a subset of the finest — so
//   they load into one frame and a subject needs a single bb.
//
// Layout per part (little-endian):
//   u32 nVerts, u32 nTris, u32 wide,
//   int16  pos[3n]  quantised over the SUBJECT's bb (0.3 mm on a 20 m tree),
//   int8   nrm[3n]  snorm unit normal (~0.9 deg),
//   uint16 uv[2n]   quantised over the PART's own uv range,
//   uint8  ao[n]    0 = fully occluded, 255 = open sky,
//   uint16 idx[3t]  (uint32 when `wide`: a tree can pass 65536 verts where a
//                    prop never does — mountain_trees carries 168 967 tris).
//
// The bytes live in ONE binary per COLLECTION under media/geo/trees/; a part
// carries `off`/`len` into it. The viewer fetches it once, the gate reads it
// with fs, and neither ever holds a second copy.

function decodeTreePart(bb, part, bin) {
  if (!bin) throw new Error('decodeTreePart: part "' + part.mat + '" needs the ' +
    "collection's bin bytes and none were passed — treeWarm first");
  const dv = new DataView(bin.buffer, bin.byteOffset + part.off, part.len);
  const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  const wide = dv.getUint32(8, true) === 1;
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  let o = 12;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++, o += 6) {
    pos[i * 3]     = x0 + (dv.getInt16(o,     true) + 32768) * sx;
    pos[i * 3 + 1] = y0 + (dv.getInt16(o + 2, true) + 32768) * sy;
    pos[i * 3 + 2] = z0 + (dv.getInt16(o + 4, true) + 32768) * sz;
  }
  const nrm = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o++) nrm[i] = dv.getInt8(o) / 127;
  const [u0, v0] = part.uvMin, [us, vs] = part.uvScl;
  const uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++, o += 4) {
    uv[i * 2]     = u0 + dv.getUint16(o,     true) / 65535 * us;
    uv[i * 2 + 1] = v0 + dv.getUint16(o + 2, true) / 65535 * vs;
  }
  const ao = new Float32Array(nv);
  for (let i = 0; i < nv; i++, o++) ao[i] = dv.getUint8(o) / 255;
  const idx = wide ? new Uint32Array(nt * 3) : new Uint16Array(nt * 3);
  if (wide) { for (let i = 0; i < nt * 3; i++, o += 4) idx[i] = dv.getUint32(o, true); }
  else { for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true); }
  return { pos: pos, nrm: nrm, uv: uv, ao: ao, idx: idx,
           mat: part.mat, mode: part.mode, cutoff: part.cutoff };
}

// One rung of one subject: the parts that make it, already in the subject's
// own frame (trunk on the origin, base at y = 0).
function decodeTreeRung(subject, rung, bin) {
  return rung.parts.map(p => decodeTreePart(subject.bb, p, bin));
}

// The finest rung a subject has. `render_world.js` hands this to its own
// impostor bake, which is why the payload does not ship an atlas: the game
// already bakes one from whatever near geometry it is given, and a second art
// pipeline is the thing that design was written to avoid.
function treeFinest(subject) {
  return subject.rungs[0];
}

// what a rung costs, without decoding it
function treeRungTris(rung) {
  return rung.tris !== undefined ? rung.tris : 0;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decodeTreePart, decodeTreeRung, treeFinest, treeRungTris };
}
