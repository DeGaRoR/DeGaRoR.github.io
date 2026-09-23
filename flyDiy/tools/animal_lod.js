#!/usr/bin/env node
// animal_lod.js — THE ANIMALS' LEVELS OF DETAIL (2026-09-22, the user: "Can
// you do the full pipeline of import, including LODs generation through
// decimation. The LODS don't need animation, but they need a similar volume
// and color").
//
// WHAT IT DOES. Reads the baked manifests of tools/animal_prep.py, POSES each
// animal's skin at the pose its table row declares (`lodPose`), and cuts that
// static mesh down with tools/prop_lod.js's own quadric decimator — the same
// half-edge collapse on the wedge graph that cut the pier's people, the boats
// and the totem poles, so every surviving vertex keeps its position, its
// normal and its UV exactly as skinned and the level wears the animal's own
// maps with no re-bake. "A similar colour" is then not a hope: it is the same
// three maps on the same material record, and GATE ANIMALS asserts it.
//
// THREE THINGS ARE PARTICULAR TO THIS TOOL
//
//   1. THE SOURCE IS A POSE, NOT A FILE. A skinned animal has no static mesh
//      to cut; the level is the skin run through linear blend skinning at
//      (clip, second) — the bear at `Stand_Idle_01` t=0, not at its bind pose,
//      which has it up on its hind legs. The arithmetic is the same the page
//      runs every frame; here it runs once, in metres (the manifest's `scale`
//      is applied HERE, because a level is placed by propPlace and nothing
//      scales it afterwards).
//
//   2. THE BASE IS NOT CUT. These are game assets — 7 886 triangles at the
//      worst — so, unlike the totems, the full animal ships as delivered and
//      only the levels are cut. The ladder is for COUNT (nine elk, four
//      flocks), not for weight.
//
//   3. THE PACK IS A PROP PACK. `src/animals/animals_lods.js` registers with
//      registerPropPack, group `animal`, each level carrying `lodOf` (the
//      ANIMAL's key — not a prop, on purpose: the editor's palette filter
//      `!props[k].lodOf` hides levels, and nothing ever looks that base up
//      through props.js) and `lodDist`. src/viewer/animals.js builds the
//      THREE.LOD itself: level 0 is the skinned instance, the rest are these.
//
// Usage: node tools/animal_lod.js            (cut and write the pack)
//        node tools/animal_lod.js --report   (cut, print, write nothing)
// Run after tools/animal_prep.py --bake (the runner does both).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');
const { decimate, mergeParts, packParts } = require('./prop_lod.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'animals');
const INDEX = path.join(SRC, 'animals_index.json');
const OUT = path.join(SRC, 'animals_lods.js');
const MANIFEST = path.join(SRC, 'animals_packs.json');
const GEO = 'geo/animal_lod';
const MIN_TRIS = 40;

// the SHEET lives in the python table (tools/animals_table.py SHEET) — ONE
// authority, read out of its own source exactly as GATE PROPS reads the props
// table. [[target tris or a share of the base, metres], ...] by kind.
function sheet() {
  const py = fs.readFileSync(path.join(__dirname, 'animals_table.py'), 'utf8');
  const m = py.match(/^SHEET = \{([\s\S]*?)^\}/m);
  if (!m) throw new Error('animals_table.py: no SHEET');
  const out = {};
  for (const line of m[1].split('\n')) {
    const r = line.match(/'(\w+)':\s*\[(.*?)\],?\s*(#.*)?$/);
    if (!r) continue;
    out[r[1]] = r[2].trim() ? JSON.parse('[' + r[2].replace(/\[\s*/g, '[').replace(/,\s*\]/g, ']') + ']') : [];
  }
  return out;
}

// ---------------------------------------------------------------------------
// the manifests, read the way the page reads them
// ---------------------------------------------------------------------------
function readAnimals() {
  if (!fs.existsSync(INDEX))
    throw new Error('no bake at src/animals - run python tools/animal_prep.py --bake');
  const got = [];
  const sb = { registerAnimal: a => got.push(a), console, FLYDIY_ASSET_BASE: '' };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(INDEX, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sb, { filename: f });
  return got;
}

// ---------------------------------------------------------------------------
// 4x4, row-major, the little of it this needs
// ---------------------------------------------------------------------------
const mul = (a, b) => {
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
    o[i * 4 + j] = s;
  }
  return o;
};
function trs(t, r, s) {
  const [x, y, z, w] = r;
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
             2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
             2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  return new Float64Array([R[0] * s[0], R[1] * s[1], R[2] * s[2], t[0],
                           R[3] * s[0], R[4] * s[1], R[5] * s[2], t[1],
                           R[6] * s[0], R[7] * s[1], R[8] * s[2], t[2],
                           0, 0, 0, 1]);
}
const px = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
                      m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
                      m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
const dx = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
                      m[4] * p[0] + m[5] * p[1] + m[6] * p[2],
                      m[8] * p[0] + m[9] * p[1] + m[10] * p[2]];

// ---------------------------------------------------------------------------
// THE POSE: the node tree at (clip, second), then linear blend skinning
// ---------------------------------------------------------------------------
function posed(a, dec, clips) {
  const N = a.nodes.length;
  const T = a.nodes.map(n => n.t.slice()), R = a.nodes.map(n => n.r.slice()), S = a.nodes.map(n => n.s.slice());
  if (a.lodPose) {
    const [name, at] = a.lodPose;
    const c = Object.values(clips).find(q => q.name === name);
    if (!c) throw new Error(a.key + ': lodPose names "' + name + '", which is not a baked clip');
    const f = Math.max(0, Math.min(c.frames - 1, Math.round(at * c.fps)));
    let o = f * c.stride;
    for (const nd of c.nt) { T[nd] = [c.data[o], c.data[o + 1], c.data[o + 2]]; o += 3; }
    for (const nd of c.nr) { R[nd] = [c.data[o], c.data[o + 1], c.data[o + 2], c.data[o + 3]]; o += 4; }
    for (const nd of c.ns) { S[nd] = [c.data[o], c.data[o + 1], c.data[o + 2]]; o += 3; }
  }
  const W = new Array(N).fill(null);
  const world = i => {
    if (W[i]) return W[i];
    const L = trs(T[i], R[i], S[i]);
    return (W[i] = a.nodes[i].p < 0 ? L : mul(world(a.nodes[i].p), L));
  };
  for (let i = 0; i < N; i++) world(i);
  // the joint matrices: world(joint) * ibm, and the whole rig scaled to metres
  const s = a.scale;
  const SC = new Float64Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  const JM = a.joints.map((jn, k) => {
    const m = dec.ibm, o = 16 * k;
    const IBM = new Float64Array([m[o], m[o + 4], m[o + 8], m[o + 12],
                                  m[o + 1], m[o + 5], m[o + 9], m[o + 13],
                                  m[o + 2], m[o + 6], m[o + 10], m[o + 14],
                                  m[o + 3], m[o + 7], m[o + 11], m[o + 15]]);
    return mul(SC, mul(W[jn], IBM));
  });
  const out = [];
  for (const m of dec.meshes) {
    const pos = new Float64Array(m.nv * 3), nrm = new Float64Array(m.nv * 3);
    if (m.skin) {
      for (let i = 0; i < m.nv; i++) {
        const p = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
        const q = [m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]];
        let X = 0, Y = 0, Z = 0, nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < 4; k++) {
          const w = m.wt[i * 4 + k];
          if (!w) continue;
          const M = JM[m.jt[i * 4 + k]];
          const a1 = px(M, p), b1 = dx(M, q);
          X += w * a1[0]; Y += w * a1[1]; Z += w * a1[2];
          nx += w * b1[0]; ny += w * b1[1]; nz += w * b1[2];
        }
        pos[i * 3] = X; pos[i * 3 + 1] = Y; pos[i * 3 + 2] = Z;
        const L = Math.hypot(nx, ny, nz) || 1;
        nrm[i * 3] = nx / L; nrm[i * 3 + 1] = ny / L; nrm[i * 3 + 2] = nz / L;
      }
    } else {
      // a rigid child (the elk's antlers): its own node's matrix, scaled
      const M = mul(SC, W[m.node]);
      for (let i = 0; i < m.nv; i++) {
        const p = px(M, [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]]);
        const q = dx(M, [m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]]);
        const L = Math.hypot(q[0], q[1], q[2]) || 1;
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        nrm[i * 3] = q[0] / L; nrm[i * 3 + 1] = q[1] / L; nrm[i * 3 + 2] = q[2] / L;
      }
    }
    out.push({ mat: m.mat, nv: m.nv, nt: m.nt, pos, nrm, uv: m.uv, idx: m.idx });
  }
  return out;
}

// float metres -> the pack's quantised layout, over the animal's own box
function quantise(parts, bb) {
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = 65535 / Math.max(1e-6, x1 - x0), sy = 65535 / Math.max(1e-6, y1 - y0), sz = 65535 / Math.max(1e-6, z1 - z0);
  return parts.map(P => {
    const pos = new Int16Array(P.nv * 3), nrm = new Int8Array(P.nv * 3);
    for (let i = 0; i < P.nv; i++) {
      pos[i * 3] = Math.max(-32768, Math.min(32767, Math.round((P.pos[i * 3] - x0) * sx) - 32768));
      pos[i * 3 + 1] = Math.max(-32768, Math.min(32767, Math.round((P.pos[i * 3 + 1] - y0) * sy) - 32768));
      pos[i * 3 + 2] = Math.max(-32768, Math.min(32767, Math.round((P.pos[i * 3 + 2] - z0) * sz) - 32768));
      for (let k = 0; k < 3; k++)
        nrm[i * 3 + k] = Math.max(-127, Math.min(127, Math.round(P.nrm[i * 3 + k] * 127)));
    }
    return { mat: P.mat, nv: P.nv, nt: P.nt, pos, nrm, uv: Float32Array.from(P.uv), idx: Uint32Array.from(P.idx) };
  });
}

// one cut of a set of material meshes to `target` triangles in all, each
// material in proportion, never under MIN_TRIS (totem_lod.js's `cut`, verbatim
// in behaviour: what the floor adds comes off the largest so the sum holds)
function cut(meshes, bb, target) {
  const total = meshes.reduce((s, m) => s + m[1].nt, 0);
  const parts = [], next = [], notes = [];
  let nt = 0;
  const wants = meshes.map(([, M]) => Math.max(MIN_TRIS, Math.min(M.nt, Math.round(target * M.nt / total))));
  const big = wants.indexOf(Math.max(...wants));
  wants[big] = Math.max(MIN_TRIS, wants[big] - (wants.reduce((x, y) => x + y, 0) - target));
  meshes.forEach(([mat, M], mi) => {
    const D = decimate(M, bb, wants[mi]);
    next.push([mat, { nv: M.nv, nt: D.nt, pos: M.pos, nrm: M.nrm, uv: M.uv, idx: Uint32Array.from(D.idx) }]);
    for (const p of packParts(mat, M, D.idx)) parts.push(p);
    nt += D.nt;
    notes.push(mat + ' ' + M.nt + '->' + D.nt);
  });
  return { parts, next, nt, notes };
}

// the posed mesh's own box, and its size — the gate compares this with the
// animal's `dim` (the rest pose's), which is what "a similar volume" means
function boxOf(parts) {
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const P of parts) for (let i = 0; i < P.nv; i++) for (let k = 0; k < 3; k++) {
    const v = P.pos[i * 3 + k];
    if (v < bb[k]) bb[k] = v;
    if (v > bb[3 + k]) bb[3 + k] = v;
  }
  return bb.map(v => +v.toFixed(4));
}

function main(argv) {
  const report = argv.includes('--report');
  const SH = sheet();
  const animals = readAnimals();
  const { decodeAnimal, decodeAnimalClips } = require('./flight_core.js');
  const props = {}, order = [], texs = {}, usedTex = new Set();
  let base = 0, lv = 0;
  for (const a of animals) {
    const bin = fs.readFileSync(path.join(ROOT, a.bin));
    const dec = decodeAnimal(a, new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength));
    const cb = fs.readFileSync(path.join(ROOT, a.clipBin));
    const clips = decodeAnimalClips(a, new Uint8Array(cb.buffer, cb.byteOffset, cb.byteLength));
    const P = posed(a, dec, clips);
    const bb = boxOf(P);
    const dim = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(v => +v.toFixed(4));
    const levels = SH[a.kind] || [];
    console.log(a.key.padEnd(6) + String(a.nt).padStart(6) + ' tris  posed at ' +
      (a.lodPose ? (a.lodPose[0] + ' @' + a.lodPose[1] + ' s') : 'the bind pose').padEnd(28) +
      dim.map(v => v.toFixed(2)).join(' x ') + ' m   (the rest pose: ' +
      a.dim.map(v => v.toFixed(2)).join(' x ') + ')');
    base += a.nt;
    if (!levels.length) { console.log('   no level: the SHEET gives ' + a.kind + ' none'); continue; }
    // one mesh per material, welded (the cut lines prop-style parts carry are
    // not borders the decimator should keep)
    const byMat = new Map();
    for (const q of quantise(P, bb)) (byMat.get(q.mat) || byMat.set(q.mat, []).get(q.mat)).push(q);
    let meshes = [...byMat].map(([mat, parts]) => [mat, mergeParts(parts)]);
    for (const [, mrec] of byMat) void mrec;
    levels.forEach(([target, dist], li) => {
      const want = target < 1 ? Math.round(target * a.nt) : target;
      const have = meshes.reduce((s, m) => s + m[1].nt, 0);
      if (want >= 0.7 * have) {
        console.log('   l' + (li + 1) + ' skipped: ' + want + ' is not well under ' + have);
        return;
      }
      const t0 = Date.now();
      const C = cut(meshes, bb, want);
      const key = a.key + '_l' + (li + 1);
      const rec = { key, group: 'animal', label: a.label + ', LOD ' + (li + 1),
                    // `mount`: the delivered origin IS the mount point (the props'
                    // own vocabulary). A level must keep the ANIMAL's origin, or the
                    // ladder jumps at the swap — the pivot is applied in the scene.
                    lodOf: a.key, lodDist: dist, place: 'mount', pivot: a.pivot,
                    bb, dim, nv: C.parts.reduce((s, p) => s + p.nv, 0), nt: C.nt,
                    src: a.src, srcNt: a.nt, mats: JSON.parse(JSON.stringify(a.mats)), parts: C.parts };
      console.log('   ' + key.padEnd(12) + String(rec.nt).padStart(6) + ' tris' + String(rec.nv).padStart(6) +
        ' verts ' + String(rec.parts.length).padStart(2) + ' parts  past ' + String(dist).padStart(3) + ' m  ' +
        ((Date.now() - t0) / 1000).toFixed(1) + 's  ' + C.notes.join(', '));
      props[key] = rec; order.push(key);
      lv += C.nt;
      meshes = C.next;
    });
    for (const m of a.mats) for (const f of ['map', 'arm', 'nor', 'emisMap']) if (m[f]) usedTex.add(m[f]);
    Object.assign(texs, a.texs);
  }
  if (report) return;

  const emitted = [];
  for (const k of order) {
    const rec = props[k];
    const buf = Buffer.concat(rec.parts.map(p => p.bytes));
    let off = 0;
    for (const p of rec.parts) { p.off = off; p.len = p.bytes.length; off += p.len; delete p.bytes; }
    rec.bin = writeMedia(GEO, k, 'bin', buf);
    emitted.push(rec.bin);
  }
  const gone = pruneMedia(GEO, emitted);
  // the maps are the ANIMALS' own files (media/tex/animals, written and owned
  // by animal_prep.py): the pack POINTS at them, it does not copy or prune them
  const pack = { v: 2, groups: [['animal', 'animals, levels of detail']], order,
                 texs: Object.fromEntries([...usedTex].map(id => [id, texs[id]])), props };
  const body = '// GENERATED FILE - DO NOT EDIT. Built by tools/animal_lod.js from the baked\n' +
    '// manifests of tools/animal_prep.py (python tools/animal_prep.py runs both).\n' +
    '// The STATIC LEVELS of every animal: its skin posed at the table\'s `lodPose`\n' +
    '// and cut with tools/prop_lod.js\'s quadric decimator, wearing the animal\'s own\n' +
    '// maps unchanged. `lodOf` names the ANIMAL (never a prop) and `lodDist` the\n' +
    '// metres past which it stands in; src/viewer/animals.js builds the THREE.LOD.\n' +
    '// Decoded by src/core/51_prop_codec.js; geometry in media/' + GEO + '/,\n' +
    '// maps in media/tex/animals/.\n' +
    'registerPropPack((p => {\n  ' + BASE_DECL + '\n' +
    '  for (const k in p.texs) p.texs[k] = B + p.texs[k];\n' +
    '  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;\n' +
    '  return p;\n})(' + JSON.stringify(pack) + '));\n';
  fs.writeFileSync(OUT, body);
  fs.writeFileSync(MANIFEST, JSON.stringify([path.basename(OUT)], null, 1));
  const bytes = emitted.reduce((s, r) => s + fs.statSync(path.join(ROOT, r)).size, 0);
  console.log('---\n%s: %d level(s) of %d animal(s); %s base triangles + %s in the levels; geometry %s MB%s',
    path.relative(ROOT, OUT), order.length, animals.length, base.toLocaleString(), lv.toLocaleString(),
    (bytes / 1048576).toFixed(2), gone.length ? ' · pruned ' + gone.length + ' bin(s)' : '');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { posed, readAnimals, sheet };
