// prop_codec.js — decode baked HANGAR PROP payloads (see tools/prop_prep.py).
// Pure JS, no three.js: the same code runs in the artifact and in the node gate.
//
// WHY A SECOND CODEC. 50_model_codec.js bakes an AEROPLANE: one bounding box
// for the whole model, no normals (the aircraft skin is smooth-shaded from a
// recomputed normal), and a skin-deformation binding. A prop is the opposite
// case — dozens of small rigid objects, each wanting its own quantisation
// range, and each needing the AUTHOR'S normals, because a barrel whose normals
// were recomputed is a faceted barrel and a chamfer that was baked into the
// normal map has nothing to sit on. So: per-prop bb, per-part uv range, and
// normals in the payload.
//
// Layout per part (little-endian):
//   u32 nVerts, u32 nTris,
//   int16 pos[3n]  quantised over the PROP's bb (0.03 mm on a 2 m prop),
//   int8  nrm[3n]  snorm unit normal (~0.9 deg),
//   uint16 uv[2n]  quantised over the PART's own uv range (props whose uv
//                  wraps past 1.0 are normal — industrial_storage_cart does),
//   uint16 idx[3t] (nVerts is asserted <= 65536 at bake time).

function decodePropPart(bb, part) {
  const raw = (typeof atob === 'function')
    ? (() => { const s = atob(part.b64), a = new Uint8Array(s.length);
               for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; })()
    : new Uint8Array(Buffer.from(part.b64, 'base64'));
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  let o = 8;
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
  const idx = new Uint16Array(nt * 3);
  for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
  return { mat: part.mat, nv, nt, pos, nrm, uv, idx };
}

// prop -> { key, bb, parts:[{mat,nv,nt,pos,nrm,uv,idx}] }. Decoding is per
// prop, not per pack: the editor shows one at a time and the hangar places a
// handful, so nothing pays for the props it never puts on the floor.
function decodeProp(prop) {
  return { key: prop.key, bb: prop.bb,
           parts: prop.parts.map(p => decodePropPart(prop.bb, p)) };
}

// ---------------------------------------------------------------------------
// THE PROP REGISTRY. Every baked pack calls this at script eval, so by the time
// anything asks, PROP_REG holds every prop in the build, in table order. The
// registry is the ONE place the editor, the hangar and the gate agree on what
// exists — nothing downstream scans a directory or a filename.
// ---------------------------------------------------------------------------
const PROP_REG = { groups: [], props: {}, order: [], texs: {} };

function registerPropPack(pack) {
  for (const g of pack.groups || [])
    if (!PROP_REG.groups.some(x => x[0] === g[0])) PROP_REG.groups.push(g);
  for (const id in pack.texs) PROP_REG.texs[id] = pack.texs[id];
  for (const key of pack.order) {
    PROP_REG.props[key] = pack.props[key];
    PROP_REG.order.push(key);
  }
  return PROP_REG;
}

function propList(group) {
  return PROP_REG.order
    .map(k => PROP_REG.props[k])
    .filter(p => !group || p.group === group);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { decodeProp, decodePropPart, registerPropPack, propList, PROP_REG };
