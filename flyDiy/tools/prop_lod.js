#!/usr/bin/env node
// prop_lod.js — LEVELS OF DETAIL for baked props (G301, the user: "For the
// people, could you handle the decimation and texture remapping? And generate
// a couple of LODs yourself? It is important to see people from far away, but
// not to carry their full detail until up close ... As much as we can keep a
// self-contained package here, I like it better").
//
// WHAT IT DOES. Reads a baked pack (the pier kit's people by default) through
// the same pack files the page loads, decimates every listed prop to the
// triangle counts in LEVELS with a quadric-error half-edge collapse, and
// writes the levels back as props of their own — `person_andrew_l1`, `_l2`,
// `_l3` — in a pack of their own (src/pier/pier_lods.js, bins under
// media/geo/pier_lod/), each carrying `lodOf` (the full prop) and `lodDist`
// (the metres past which it stands in for it). props.js reads those two
// fields and places a THREE.LOD; nothing else in the pipeline knows.
//
// WHY HALF-EDGE (a vertex slides onto its neighbour, never to a new point):
// a surviving vertex keeps its position, its normal and its UV EXACTLY as the
// author exported them, so the level wears the same atlas with no re-bake and
// no drift — "texture remapping" is then the trivial case, the map stays and
// the mesh is a subset. The pack's int16 positions ride through untouched.
//
// WHY SEAMS ARE HANDLED. The atlas is cut into islands; at a cut the mesh
// carries two vertices at one position (two "wedges"). Collapsing one wedge
// and not its twin opens a crack. So the topology is the wedge graph, the
// quadric is per POSITION (both wedges share it), a seam edge gets a
// boundary penalty (a plane through it, normal to the face) so it stays where
// it was drawn, and a position may only collapse when EVERY wedge of it has
// a wedge of the target to collapse into along a shared triangle — a seam
// vertex collapses along its seam or not at all.
//
// Usage: node tools/prop_lod.js            (bake the levels)
//        node tools/prop_lod.js --report   (decimate, print, write nothing)
// Run after tools/pier_prep.py (the levels are cut from its bins).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const PIER = path.join(ROOT, 'src', 'pier');
const SUB = 'geo/pier_lod';
const OUT = path.join(PIER, 'pier_lods.js');
const MANIFEST = path.join(PIER, 'pier_packs.json');

// THE LEVELS, per group: [target, floor, metres] - the target a triangle
// count (>= 1) or a share of the prop's own (< 1), never cut below `floor`
// triangles, standing in past `metres`. A level whose target is not well
// under the prop (< 0.7 of it) is not cut: a 2k K-car gets no 24k level.
// A 1.8 m person on a 1080-pixel view at 50 deg is ~85 px tall at 25 m and
// ~24 px at 90 m; 5k triangles is dense at the first, 1.2k a silhouette at
// the second. Level 1 is a fifth of a person's delivered mesh - still every
// fold of the jacket - for the middle distance, where most of a village is
// seen from. The boats, the cars, the pier modules and the yard (G303) cut
// by share: a 370k Grady-White to 92k / 22k / 5.5k, a 12k pier run to
// 3.6k / 1k.
const LEVELS = {
  people: [[24000, 24000, 8], [5000, 5000, 30], [1200, 1200, 90]],
  boat:   [[0.25, 3000, 15], [0.06, 800, 45], [0.015, 250, 120]],
  car:    [[0.25, 2500, 15], [0.06, 700, 45], [0.015, 200, 120]],
  vehicle: [[0.25, 2500, 15], [0.06, 700, 45], [0.015, 200, 120]],   // the fire trucks (G410): 2k-triangle game assets, cut like the cars
  auto:   [[0.25, 2500, 15], [0.06, 700, 45], [0.015, 200, 120]],   // the everyday vehicles (G432): 0.4-9k-triangle game assets, cut like the cars - the 2k bodies get a 700 and a 200, the semis a 2.5k first
  pier:   [[0.3, 2000, 20], [0.08, 600, 60]],
  yard:   [[0.25, 1200, 20], [0.06, 400, 60]],
};
// the levels a prop actually gets: [target tris, metres]
function levelsFor(prop) {
  const out = [];
  for (const [t, floor, d] of LEVELS[prop.group] || []) {
    const want = Math.max(floor, t < 1 ? Math.round(t * prop.nt) : t);
    if (want < 0.7 * prop.nt) out.push([want, d]);
  }
  return out;
}
// per material: the small props on a person (a phone, the notes) shrink in
// the same ratio as the body but never below this many triangles
const MIN_TRIS = 60;
// boundary penalties, in units of edge length squared (the face quadrics are
// area-weighted): a true border is stiff, an atlas seam a little less
const W_BORDER = 10, W_SEAM = 1;
// a collapse that turns a triangle over (its normal past this cosine from
// where it was) is refused
const FLIP_COS = 0.2;

// ---------------------------------------------------------------------------
// reading the packs the way the page does: the file is a script that calls
// registerPropPack(pack) with B = '' here, so `bin` is the media path
// ---------------------------------------------------------------------------
function readPacks() {
  const raw = [];
  const sb = { registerPropPack: p => raw.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(MANIFEST, 'utf8')))
    if (f !== path.basename(OUT))
      vm.runInContext(fs.readFileSync(path.join(PIER, f), 'utf8'), sb, { filename: f });
  return raw;
}

// one part of a prop's bin, RAW: the int16/int8/uint16 exactly as packed
function readPart(bin, part) {
  const dv = new DataView(bin.buffer, bin.byteOffset + part.off, part.len);
  const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  let o = 8;
  const pos = new Int16Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o += 2) pos[i] = dv.getInt16(o, true);
  const nrm = new Int8Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o++) nrm[i] = dv.getInt8(o);
  const uv = new Float32Array(nv * 2);
  const [u0, v0] = part.uvMin, [us, vs] = part.uvScl;
  for (let i = 0; i < nv; i++, o += 4) {
    uv[i * 2] = u0 + dv.getUint16(o, true) / 65535 * us;
    uv[i * 2 + 1] = v0 + dv.getUint16(o + 2, true) / 65535 * vs;
  }
  const idx = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
  return { nv, nt, pos, nrm, uv, idx };
}

// ---------------------------------------------------------------------------
// one material's mesh out of its parts (prop_prep cuts a material at 65 536
// vertices, duplicating the vertices on the cut - welded back here so a cut
// line is not a border the decimator would keep)
// ---------------------------------------------------------------------------
// A WEDGE IS A TOLERANCE, NOT A KEY: two exports of these (andrew, koky)
// carry every vertex twice with UVs a quantisation step apart (< 1e-4, a
// tenth of a texel) and identical normals - an exact key kept 300k wedges
// for 176k positions and the seam rule then refused half the collapses. Same
// position, normal within a few int8 steps, uv within UV_TOL: one wedge.
const UV_TOL = 3e-4, NRM_TOL = 3;
function mergeParts(parts) {
  const key = new Map();        // 'x,y,z' -> [wedge, ...] at that position
  const pos = [], nrm = [], uv = [], idx = [];
  for (const P of parts) {
    const map = new Int32Array(P.nv);
    for (let i = 0; i < P.nv; i++) {
      const k = P.pos[i * 3] + ',' + P.pos[i * 3 + 1] + ',' + P.pos[i * 3 + 2];
      let ws = key.get(k);
      if (!ws) key.set(k, ws = []);
      let j = -1;
      for (const w of ws) {
        if (Math.abs(nrm[w * 3] - P.nrm[i * 3]) > NRM_TOL || Math.abs(nrm[w * 3 + 1] - P.nrm[i * 3 + 1]) > NRM_TOL ||
            Math.abs(nrm[w * 3 + 2] - P.nrm[i * 3 + 2]) > NRM_TOL) continue;
        if (Math.abs(uv[w * 2] - P.uv[i * 2]) > UV_TOL || Math.abs(uv[w * 2 + 1] - P.uv[i * 2 + 1]) > UV_TOL) continue;
        j = w; break;
      }
      if (j < 0) {
        j = pos.length / 3;
        ws.push(j);
        pos.push(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
        nrm.push(P.nrm[i * 3], P.nrm[i * 3 + 1], P.nrm[i * 3 + 2]);
        uv.push(P.uv[i * 2], P.uv[i * 2 + 1]);
      }
      map[i] = j;
    }
    for (let t = 0; t < P.nt; t++) {
      const a = map[P.idx[t * 3]], b = map[P.idx[t * 3 + 1]], c = map[P.idx[t * 3 + 2]];
      if (a === b || b === c || a === c) continue;
      idx.push(a, b, c);
    }
  }
  return { nv: pos.length / 3, nt: idx.length / 3,
           pos: Int16Array.from(pos), nrm: Int8Array.from(nrm),
           uv: Float32Array.from(uv), idx: Uint32Array.from(idx) };
}

// ---------------------------------------------------------------------------
// THE DECIMATOR. Garland-Heckbert quadrics per position, half-edge collapses
// on the wedge graph, lazy heap.
// ---------------------------------------------------------------------------
// THE DECIMATOR MOVED (G411): the body that stood here is src/core/54_decimate.js's
// meshDecimate, byte for byte (the game cuts a parked aeroplane's levels with it at
// run time; one decimator, two callers). The knobs above are handed to it.
function decimate(M, bb, target) {
  const { meshDecimate } = require('./flight_core.js');
  return meshDecimate(M, bb, target, { W_BORDER, W_SEAM, FLIP_COS });
}

// ---------------------------------------------------------------------------
// back into pack parts: <= 65 534 vertices each, the pack's own layout
// ---------------------------------------------------------------------------
function packParts(name, M, idx) {
  const parts = [];
  const CAP = 65534;
  let t = 0;
  const nt = idx.length / 3;
  while (t < nt) {
    const map = new Map(), verts = [], tris = [];
    while (t < nt) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      let need = 0;
      for (const w of [a, b, c]) if (!map.has(w)) need++;
      if (verts.length + need > CAP) break;
      const tr = [];
      for (const w of [a, b, c]) {
        let j = map.get(w);
        if (j === undefined) { j = verts.length; map.set(w, j); verts.push(w); }
        tr.push(j);
      }
      tris.push(tr);
      t++;
    }
    const nv = verts.length;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const w of verts) {
      const u = M.uv[w * 2], v = M.uv[w * 2 + 1];
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const ur = (u1 - u0) || 1.0, vr = (v1 - v0) || 1.0;
    const buf = Buffer.alloc(8 + nv * 6 + nv * 3 + nv * 4 + tris.length * 6);
    let o = 0;
    buf.writeUInt32LE(nv, 0); buf.writeUInt32LE(tris.length, 4); o = 8;
    for (const w of verts) { buf.writeInt16LE(M.pos[w * 3], o); buf.writeInt16LE(M.pos[w * 3 + 1], o + 2); buf.writeInt16LE(M.pos[w * 3 + 2], o + 4); o += 6; }
    for (const w of verts) { buf.writeInt8(M.nrm[w * 3], o); buf.writeInt8(M.nrm[w * 3 + 1], o + 1); buf.writeInt8(M.nrm[w * 3 + 2], o + 2); o += 3; }
    for (const w of verts) {
      buf.writeUInt16LE(Math.round((M.uv[w * 2] - u0) / ur * 65535), o);
      buf.writeUInt16LE(Math.round((M.uv[w * 2 + 1] - v0) / vr * 65535), o + 2);
      o += 4;
    }
    for (const tr of tris) { buf.writeUInt16LE(tr[0], o); buf.writeUInt16LE(tr[1], o + 2); buf.writeUInt16LE(tr[2], o + 4); o += 6; }
    parts.push({ mat: name, nv, nt: tris.length,
                 uvMin: [+u0.toFixed(6), +v0.toFixed(6)], uvScl: [+ur.toFixed(6), +vr.toFixed(6)],
                 bytes: buf });
  }
  return parts;
}

// ---------------------------------------------------------------------------
function main(argv) {
  const report = argv.includes('--report');
  const only = argv.filter(a => !a.startsWith('--'));
  const packs = readPacks();
  const texs = {};
  for (const p of packs) Object.assign(texs, p.texs);
  const props = {}, order = [], emitted = [], usedTex = new Set();
  let tris0 = 0, tris1 = 0;
  for (const pack of packs) for (const key of pack.order) {
    const prop = pack.props[key];
    const levels = levelsFor(prop);
    if (!levels.length || (only.length && !only.includes(key))) continue;
    const bin = fs.readFileSync(path.join(ROOT, prop.bin));
    // the material meshes, welded across the baker's 65k cuts
    const byMat = new Map();
    for (const part of prop.parts) (byMat.get(part.mat) || byMat.set(part.mat, []).get(part.mat)).push(readPart(bin, part));
    const meshes = [];
    for (const [mat, parts] of byMat) meshes.push([mat, mergeParts(parts)]);
    const total = meshes.reduce((s, m) => s + m[1].nt, 0);
    console.log('%s  %d parts, %d materials, %d tris (%d welded)', key, prop.parts.length, meshes.length, prop.nt, total);
    tris0 += prop.nt;
    let prev = null;
    levels.forEach(([target, dist], li) => {
      const lk = key + '_l' + (li + 1);
      const t0 = Date.now();
      const parts = [], next = new Map();
      let nt = 0, note = [];
      for (const [mat, M] of meshes) {
        const want = Math.max(MIN_TRIS, Math.round(target * M.nt / total));
        const src = prev ? prev.get(mat) : M;
        const D = decimate(src, prop.bb, want);
        next.set(mat, { nv: src.nv, nt: D.nt, pos: src.pos, nrm: src.nrm, uv: src.uv, idx: Uint32Array.from(D.idx) });
        for (const p of packParts(mat, src, D.idx)) parts.push(p);
        nt += D.nt;
        if (D.nBorder !== undefined) note.push(mat + ' ' + src.nt + '->' + D.nt + (D.nSeam ? ' seam ' + D.nSeam : '') + (D.nBorder ? ' border ' + D.nBorder : '') + ' refused ' + D.refused + '/' + D.refSeam);
      }
      // one level is cut from the one above it, so the chain is consistent
      // and the small levels fall out fast
      prev = next;
      const nv = parts.reduce((s, p) => s + p.nv, 0);
      const rec = { key: lk, group: 'lod', label: prop.label + ', LOD ' + (li + 1), lodOf: key, lodDist: dist,
                    place: prop.place, bb: prop.bb, dim: prop.dim, nv, nt, src: prop.src,
                    mats: JSON.parse(JSON.stringify(prop.mats)), parts };
      for (const m in rec.mats) for (const f of ['map', 'nor', 'arm', 'emisMap', 'aoMap'])
        if (rec.mats[m][f]) usedTex.add(rec.mats[m][f]);
      const geo = parts.reduce((s, p) => s + p.bytes.length, 0);
      console.log('  ' + lk.padEnd(20) + String(nt).padStart(7) + ' tris' + String(nv).padStart(7) + ' verts ' + String(parts.length).padStart(2) + ' parts ' + (geo / 1024).toFixed(1).padStart(6) + ' KB  past ' + String(dist).padStart(3) + ' m  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  ' + note.join(', '));
      tris1 += nt;
      props[lk] = rec;
      order.push(lk);
    });
  }
  if (report) return;
  for (const k of order) {
    const rec = props[k];
    const buf = Buffer.concat(rec.parts.map(p => p.bytes));
    let off = 0;
    for (const p of rec.parts) { p.off = off; p.len = p.bytes.length; off += p.len; delete p.bytes; }
    rec.bin = writeMedia(SUB, k, 'bin', buf);
    emitted.push(rec.bin);
  }
  const gone = pruneMedia(SUB, emitted);
  const pack = { v: 2, groups: [['lod', 'levels of detail']], order,
                 texs: Object.fromEntries([...usedTex].map(id => [id, texs[id]])), props };
  const body = '// GENERATED FILE - DO NOT EDIT. Built by tools/prop_lod.js from the\n' +
    '// baked pier packs. Group: levels of detail - every prop here\n' +
    '// is a decimated stand-in for the prop named by its `lodOf`, used past\n' +
    '// `lodDist` metres (src/viewer/props.js places a THREE.LOD). Decoded by\n' +
    '// src/core/51_prop_codec.js; geometry in media/' + SUB + '/, textures the\n' +
    '// full props\' own in media/tex/pier/.\n' +
    'registerPropPack((p => {\n  ' + BASE_DECL + '\n' +
    '  for (const k in p.texs) p.texs[k] = B + p.texs[k];\n' +
    '  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;\n' +
    '  return p;\n})(' + JSON.stringify(pack) + '));\n';
  fs.writeFileSync(OUT, body);
  const mf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (!mf.includes(path.basename(OUT))) {
    mf.push(path.basename(OUT));
    fs.writeFileSync(MANIFEST, JSON.stringify(mf, null, 1));
  }
  console.log('---\n%s: %d levels of %d props, %s -> %s tris in the levels, %d bins in media/%s/%s',
    path.relative(ROOT, OUT), order.length, new Set(order.map(k => props[k].lodOf)).size, tris0.toLocaleString(), tris1.toLocaleString(),
    emitted.length, SUB, gone.length ? ' · pruned ' + gone.join(', ') : '');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { decimate, mergeParts, packParts, readPart, LEVELS, levelsFor };
