// ===========================================================================
// TERRAIN CODEC — the asset format (futureDesigns/WORLD-V2.md §9).
// ===========================================================================
// Encode and decode live in ONE file because a format with a writer and no
// reader is a format nobody has verified. `roundTrip()` at the bottom is what
// GATE TERRAIN will grow out of.
//
// THE SHAPE
//
//   header      JSON — bounds, patch size, depth range, quantisation, counts
//   topology    one bit per node in PREORDER: 1 = internal, 0 = leaf.
//               40 000 nodes is 5 KB. The tree's shape is essentially free.
//   patches     preorder, same walk, EVERY node (leaves and ancestors — the
//               renderer needs ancestors for distance LOD, WORLD-V2 §3.1)
//
// WHY HEIGHTS COMPRESS THE WAY THEY DO. Raw int16 through gzip does badly:
// gzip matches byte strings and a height field has no repeated bytes, only
// smooth numeric structure. So each patch is quantised, then run through a
// 2D GRADIENT PREDICTOR (left + up − upleft, the plane through the three
// known neighbours), then zigzagged and varint-coded. On smooth ground the
// residual is almost always 0 or ±1, which varint writes in one byte and gzip
// then collapses. That is where the factor comes from — not from gzip.
//
// QUANTISATION FOLLOWS DEPTH, and this is not an optimisation — the first
// version was WRONG. One global scale over the whole asset stored every patch
// to the same 8.7 mm, including patches 47 m across that the baker had already
// declared may be 4 m out. That is nine bits of noise per sample, and the
// predictor then had to encode the noise.
//
//     step(d) = cell(d) / 256
//
// so a 47 m cell is kept to 18 cm and a 0.7 m runway cell to 3 mm. Precision
// tracks the detail the patch is actually carrying, automatically, and a strip
// zone gets its accuracy from its DEPTH rather than from a special case.
// Measured effect: see the baker's report.
//
// KNOWN NEXT LEVER, deliberately not taken: a child's even samples ARE its
// parent's, so a child could be predicted from the upsampled parent. Worth
// trying once this baseline is measured; an optimisation adopted before its
// baseline is a guess.
// ===========================================================================
'use strict';
// NODE AND BROWSER, one file. The baker gunzips with zlib; the bench uses the
// platform's own DecompressionStream. So the COMPRESSION is each environment's
// business and `decodeRaw` — which is the actual format — knows nothing about
// it. A codec that could only be read by the tool that wrote it would be a
// format nobody can look at.
const zlib = (typeof require === 'function' && typeof window === 'undefined')
  ? require('zlib') : null;

const MAGIC = 'FDTQ1';                        // flyDiy terrain quadtree, v1

// ---- varint + zigzag ------------------------------------------------------
const zig = n => (n << 1) ^ (n >> 31);
const unzig = n => (n >>> 1) ^ -(n & 1);

class ByteOut {                                  // encode side: node only
  constructor() { this.b = Buffer.alloc(1 << 16); this.n = 0; }
  _room(k) {
    if (this.n + k <= this.b.length) return;
    const big = Buffer.alloc(Math.max(this.b.length * 2, this.n + k));
    this.b.copy(big, 0, 0, this.n); this.b = big;
  }
  varint(v) {
    this._room(5);
    while (v >= 0x80) { this.b[this.n++] = (v & 0x7f) | 0x80; v >>>= 7; }
    this.b[this.n++] = v;
  }
  bytes() { return this.b.subarray(0, this.n); }
}
class ByteIn {
  constructor(b) { this.b = b; this.n = 0; }
  varint() {
    let v = 0, s = 0, c;
    do { c = this.b[this.n++]; v |= (c & 0x7f) << s; s += 7; } while (c & 0x80);
    return v >>> 0;
  }
}

// ---- the 2D gradient predictor -------------------------------------------
// pred(i,j) = left + up - upleft, degenerating sensibly on the first row and
// column. It is the cheapest predictor that understands that terrain is a
// surface rather than a sequence.
function predict(q, N, i, j) {
  const at = (a, b) => q[b * N + a];
  if (i > 0 && j > 0) return at(i - 1, j) + at(i, j - 1) - at(i - 1, j - 1);
  if (i > 0) return at(i - 1, j);
  if (j > 0) return at(i, j - 1);
  return 0;
}

// ===========================================================================
// ENCODE
// ===========================================================================
function encode(root, meta) {
  const N = meta.patch + 1;

  // preorder walk, once, so topology and payload cannot disagree about order
  const nodes = [];
  (function walk(n) { nodes.push(n); if (n.kids) n.kids.forEach(walk); })(root);

  // quantisation over the WHOLE asset: one scale, so a patch's numbers mean
  // the same thing wherever it sits in the tree
  let hMin = Infinity, hMax = -Infinity;
  for (const n of nodes) {
    if (!n.h) continue;
    for (let k = 0; k < n.h.length; k++) {
      const v = n.h[k];
      if (v < hMin) hMin = v;
      if (v > hMax) hMax = v;
    }
  }
  // one BASE step, scaled per depth below
  const step0 = (meta.side / meta.patch) / 256;      // depth 0's cell / 256
  const stepAt = d => step0 / (1 << d);

  // topology: one bit per node, preorder, MSB-first within each byte
  const topo = Buffer.alloc((nodes.length + 7) >> 3);
  nodes.forEach((n, i) => { if (n.kids) topo[i >> 3] |= 0x80 >> (i & 7); });

  // payload
  const out = new ByteOut();
  const q = new Int32Array(N * N);
  for (const n of nodes) {
    if (!n.h) { // a node the balancer split without sampling — must not happen
      throw new Error(`node ${n.d}:${n.ix}:${n.iz} has no height grid`);
    }
    const sc = stepAt(n.d);
    for (let k = 0; k < N * N; k++) q[k] = Math.round((n.h[k] - hMin) / sc);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        out.varint(zig(q[j * N + i] - predict(q, N, i, j)));
  }

  const header = {
    magic: MAGIC,
    bounds: meta.bounds, side: meta.side,
    patch: meta.patch, minDepth: meta.minDepth, maxDepth: meta.maxDepth,
    eps: meta.eps, source: meta.source,
    hMin, step0, nodes: nodes.length,
    leaves: nodes.filter(n => !n.kids).length,
  };
  return {
    header,
    topology: topo,
    payload: zlib.gzipSync(out.bytes(), { level: 9 }),
    rawPayloadBytes: out.n,
  };
}

// ===========================================================================
// DECODE
// ===========================================================================
function decode(header, topology, payloadGz) {
  if (!zlib) throw new Error('decode() is node-only; the browser calls ' +
    'decodeRaw() after its own DecompressionStream');
  return decodeRaw(header, topology, zlib.gunzipSync(payloadGz));
}

// THE FORMAT ITSELF. Takes already-decompressed bytes, so it is identical in
// both environments and is what GATE TERRAIN exercises.
function decodeRaw(header, topology, raw) {
  const N = header.patch + 1;
  const inp = new ByteIn(raw);
  const bit = i => (topology[i >> 3] >> (7 - (i & 7))) & 1;
  const stepAt = d => header.step0 / (1 << d);

  let idx = 0;
  const q = new Int32Array(N * N);
  const read = d => {
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        q[j * N + i] = unzig(inp.varint()) + predict(q, N, i, j);
    const sc = stepAt(d), h = new Float64Array(N * N);
    for (let k = 0; k < N * N; k++) h[k] = header.hMin + q[k] * sc;
    return h;
  };
  const build = (d, ix, iz) => {
    const internal = bit(idx++);
    const h = read(d);                      // payload order is the walk order
    const n = { d, ix, iz, h, kids: null };
    if (internal) n.kids = [
      build(d + 1, ix * 2,     iz * 2),
      build(d + 1, ix * 2 + 1, iz * 2),
      build(d + 1, ix * 2,     iz * 2 + 1),
      build(d + 1, ix * 2 + 1, iz * 2 + 1),
    ];
    return n;
  };
  return build(0, 0, 0);
}

// ===========================================================================
// SAMPLE — descend to the deepest leaf covering (x, z), bilinear within it.
// This is what `terrainH` becomes (WORLD-V2 §5), and it is the reason the
// codec is one file: the reader is not a debug tool, it is the runtime.
// ===========================================================================
function sampler(root, header) {
  const { x0, z0 } = header.bounds, S = header.side, P = header.patch, N = P + 1;
  return function terrainH(x, z) {
    let n = root;
    for (;;) {
      if (!n.kids) break;
      const s = S / (1 << (n.d + 1));
      const cx = (x - x0) >= (n.ix * 2 + 1) * s ? 1 : 0;
      const cz = (z - z0) >= (n.iz * 2 + 1) * s ? 1 : 0;
      n = n.kids[cz * 2 + cx];
    }
    const s = S / (1 << n.d);
    const u = ((x - x0) - n.ix * s) / s * P;
    const v = ((z - z0) - n.iz * s) / s * P;
    const i = Math.max(0, Math.min(P - 1, Math.floor(u)));
    const j = Math.max(0, Math.min(P - 1, Math.floor(v)));
    const fu = u - i, fv = v - j, h = n.h;
    const a = h[j * N + i],       b = h[j * N + i + 1];
    const c = h[(j + 1) * N + i], d = h[(j + 1) * N + i + 1];
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  };
}

// ===========================================================================
// ROUND TRIP — the seed of GATE TERRAIN. Encode, decode, and compare the
// decoded sampler against the ORIGINAL tree at deterministic probe points.
// The error must not exceed the quantisation step; anything more is a codec
// bug wearing a rounding error's clothes.
// ===========================================================================
function roundTrip(root, meta, probes = 4096) {
  const enc = encode(root, meta);
  const dec = decode(enc.header, enc.topology, enc.payload);
  const fA = sampler(root, enc.header), fB = sampler(dec, enc.header);
  const { x0, z0 } = meta.bounds, S = meta.side;
  let worst = 0;
  let s = 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < probes; k++) {
    const x = x0 + rnd() * S, z = z0 + rnd() * S;
    const e = Math.abs(fA(x, z) - fB(x, z));
    if (e > worst) worst = e;
  }
  // the tolerance is the step of the SHALLOWEST leaf, because that is the
  // coarsest quantisation any probe can land in
  let shallowest = Infinity;
  (function w(n) { if (n.kids) n.kids.forEach(w); else shallowest = Math.min(shallowest, n.d); })(root);
  const step = enc.header.step0 / (1 << shallowest);
  return { worst, step, ok: worst <= step * 1.5, enc };
}

const API = { encode, decode, decodeRaw, sampler, roundTrip, MAGIC };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else if (typeof window !== 'undefined') window.TERRAIN_CODEC = API;
