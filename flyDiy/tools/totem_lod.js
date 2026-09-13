#!/usr/bin/env node
// totem_lod.js — THE TOTEM POLES, CUT TO SIZE (2026-09-13, the user: "These
// assets are photoscans and need to be decimated, at least for generating
// LODs. Can you handle the game-readification?").
//
// WHAT IT DOES. Reads the STAGED as-is bake of tools/totem_table.py (what
// tools/totem_prep.py wrote to bench/totems/: every triangle the scanner
// shipped, 144-438k a pole), and cuts what ships with tools/prop_lod.js's own
// quadric decimator - the same half-edge collapse on the wedge graph that cut
// the people and the boats (G301/G303), so every surviving vertex keeps its
// position, normal and uv exactly as scanned and the level wears the
// delivered map with no re-bake. Two things differ from prop_lod.js:
//
//   1. THE BASE IS A CUT TOO. The pier's levels stand under an as-is base;
//      a photoscan's as-is base is the scanner's noise floor (a 7 m log at
//      380k triangles carries no shape a 40k one does not - the shape is in
//      the photograph), and 2.5 M triangles of poles would be the whole
//      village's budget twice. So `base` in the SHEET is the triangle count
//      the full prop ships at; the record keeps `srcNt`, what it was cut
//      from, for the plaque and the gate.
//   2. THE PACK IS ITS OWN. src/totems/totems_poles.js carries both the poles
//      (group `totem`) and their levels (group `lod`, `lodOf` + `lodDist` as
//      props.js reads them); bins under media/geo/totems/, the maps the stage
//      wrote under media/tex/totems/. This tool owns and prunes both dirs.
//
// THE SHEET, by group: base = [tris]; levels = [[tris, metres], ...]. A pole
// is 6-19 m tall: on a 1080 view at 50 deg an 8 m pole is ~230 px at 40 m
// and ~77 px at 120 m - 3k triangles is dense at the first, 700 a clean
// silhouette at the second. The base holds to 12 m, where the carving is
// read face to face; 12k past it is the middle distance most of a park is
// seen from.
//
// Usage: node tools/totem_lod.js            (cut and write the pack)
//        node tools/totem_lod.js --report   (cut, print, write nothing)
// Run after tools/totem_prep.py --stage (the runner does both).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');
const { decimate, mergeParts, packParts, readPart } = require('./prop_lod.js');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'bench', 'totems');
const STAGE_MF = path.join(STAGE, 'totems_full_packs.json');
const OUT_DIR = path.join(ROOT, 'src', 'totems');
const OUT = path.join(OUT_DIR, 'totems_poles.js');
const MANIFEST = path.join(OUT_DIR, 'totems_packs.json');
const GEO = 'geo/totems', TEX = 'tex/totems';

const SHEET = {
  totem: { base: 40000, levels: [[12000, 12], [3000, 40], [700, 120]] },
};
// the levels a prop gets: [[tris, metres], ...] - the one keeper of the rule,
// read by GATE TOTEM too
function levelsFor(prop) {
  const s = SHEET[prop.group];
  return s ? s.levels.slice() : [];
}
function baseFor(prop) {
  const s = SHEET[prop.group];
  return s ? s.base : null;
}
const MIN_TRIS = 60;

function readStage() {
  if (!fs.existsSync(STAGE_MF))
    throw new Error('no staged bake at ' + path.relative(ROOT, STAGE) + ' - run python tools/totem_prep.py --stage');
  const raw = [];
  const sb = { registerPropPack: p => raw.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(STAGE_MF, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(STAGE, f), 'utf8'), sb, { filename: f });
  return raw;
}

// one cut of a set of material meshes to `target` triangles in all, each
// material in proportion, never under MIN_TRIS; returns the parts and the
// meshes the next cut starts from
function cut(meshes, bb, target) {
  const total = meshes.reduce((s, m) => s + m[1].nt, 0);
  const parts = [], next = [], notes = [];
  let nt = 0;
  // each material in proportion, none under MIN_TRIS - and what the floor
  // adds comes off the largest, so the sum stays the target (the great pole's
  // three materials overshot its 700 level by 45 before this)
  const wants = meshes.map(([, M]) => Math.max(MIN_TRIS, Math.min(M.nt, Math.round(target * M.nt / total))));
  const big = wants.indexOf(Math.max(...wants));
  wants[big] = Math.max(MIN_TRIS, wants[big] - (wants.reduce((a, b) => a + b, 0) - target));
  meshes.forEach(([mat, M], mi) => {
    const want = wants[mi];
    const D = decimate(M, bb, want);
    next.push([mat, { nv: M.nv, nt: D.nt, pos: M.pos, nrm: M.nrm, uv: M.uv, idx: Uint32Array.from(D.idx) }]);
    for (const p of packParts(mat, M, D.idx)) parts.push(p);
    nt += D.nt;
    if (D.nBorder !== undefined)
      notes.push(mat + ' ' + M.nt + '->' + D.nt + (D.nSeam ? ' seam ' + D.nSeam : '') + (D.nBorder ? ' border ' + D.nBorder : '') + ' refused ' + D.refused + '/' + D.refSeam);
  });
  return { parts, next, nt, notes };
}

function main(argv) {
  const report = argv.includes('--report');
  const only = argv.filter(a => !a.startsWith('--'));
  const packs = readStage();
  const texs = {};
  for (const p of packs) Object.assign(texs, p.texs);
  const props = {}, order = [], lodOrder = [], usedTex = new Set();
  let tris0 = 0, trisBase = 0, trisLv = 0;
  const groups = [];
  for (const pack of packs) {
    for (const g of pack.groups) if (!groups.some(x => x[0] === g[0])) groups.push(g);
    for (const key of pack.order) {
      const prop = pack.props[key];
      if (only.length && !only.includes(key)) continue;
      const base = baseFor(prop);
      if (base === null) throw new Error(key + ': group ' + prop.group + ' has no entry in the SHEET');
      const bin = fs.readFileSync(path.join(ROOT, prop.bin));
      const byMat = new Map();
      for (const part of prop.parts) (byMat.get(part.mat) || byMat.set(part.mat, []).get(part.mat)).push(readPart(bin, part));
      let meshes = [];
      for (const [mat, parts] of byMat) meshes.push([mat, mergeParts(parts)]);
      const welded = meshes.reduce((s, m) => s + m[1].nt, 0);
      console.log('%s  %d parts, %d materials, %d tris (%d welded), %s', key, prop.parts.length, meshes.length, prop.nt, welded, prop.dim.map(v => v.toFixed(2)).join(' x ') + ' m');
      tris0 += prop.nt;
      for (const m in prop.mats) for (const f of ['map', 'nor', 'arm', 'emisMap'])
        if (prop.mats[m][f]) usedTex.add(prop.mats[m][f]);
      // the base
      let t0 = Date.now();
      let C = cut(meshes, prop.bb, base);
      const rec = Object.assign({}, prop, { parts: C.parts, nt: C.nt, nv: C.parts.reduce((s, p) => s + p.nv, 0),
                                            srcNt: prop.nt, srcNv: prop.nv });
      delete rec.bin;
      say(key, rec, C, 0, t0);
      trisBase += C.nt;
      props[key] = rec; order.push(key);
      meshes = C.next;
      // the levels, each cut from the one above
      levelsFor(prop).forEach(([target, dist], li) => {
        const lk = key + '_l' + (li + 1);
        t0 = Date.now();
        C = cut(meshes, prop.bb, target);
        const lv = { key: lk, group: 'lod', label: prop.label + ', LOD ' + (li + 1), lodOf: key, lodDist: dist,
                     place: prop.place, bb: prop.bb, dim: prop.dim, nv: C.parts.reduce((s, p) => s + p.nv, 0), nt: C.nt,
                     src: prop.src, mats: JSON.parse(JSON.stringify(prop.mats)), parts: C.parts };
        say(lk, lv, C, dist, t0);
        trisLv += C.nt;
        props[lk] = lv; lodOrder.push(lk);
        meshes = C.next;
      });
    }
  }
  function say(k, rec, C, dist, t0) {
    const geo = rec.parts.reduce((s, p) => s + p.bytes.length, 0);
    console.log('  ' + k.padEnd(20) + String(rec.nt).padStart(7) + ' tris' + String(rec.nv).padStart(7) + ' verts ' +
      String(rec.parts.length).padStart(2) + ' parts ' + (geo / 1024).toFixed(1).padStart(7) + ' KB  ' +
      (dist ? 'past ' + String(dist).padStart(3) + ' m' : 'the base ') + '  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  ' + C.notes.join(', '));
  }
  if (report) return;
  if (only.length) throw new Error('a partial cut would rewrite the pack with only part of it in - cut the whole stage, or pass --report');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all = order.concat(lodOrder), emitted = [];
  for (const k of all) {
    const rec = props[k];
    const buf = Buffer.concat(rec.parts.map(p => p.bytes));
    let off = 0;
    for (const p of rec.parts) { p.off = off; p.len = p.bytes.length; off += p.len; delete p.bytes; }
    rec.bin = writeMedia(GEO, k, 'bin', buf);
    emitted.push(rec.bin);
  }
  const goneGeo = pruneMedia(GEO, emitted);
  const texKeep = [...usedTex].map(id => texs[id]);
  const goneTex = pruneMedia(TEX, texKeep);
  const pack = { v: 2, groups: groups.concat([['lod', 'levels of detail']]), order: all,
                 texs: Object.fromEntries([...usedTex].map(id => [id, texs[id]])), props };
  const body = '// GENERATED FILE - DO NOT EDIT. Built by tools/totem_lod.js from the staged\n' +
    '// as-is bake of tools/totem_table.py (python tools/totem_prep.py runs both).\n' +
    '// Groups: totem poles (each a quadric cut of its scan to the SHEET\'s base,\n' +
    '// `srcNt` what it was cut from) and levels of detail (`lodOf` + `lodDist`;\n' +
    '// src/viewer/props.js places a THREE.LOD). Decoded by src/core/51_prop_codec.js;\n' +
    '// geometry in media/' + GEO + '/, textures in media/' + TEX + '/.\n' +
    'registerPropPack((p => {\n  ' + BASE_DECL + '\n' +
    '  for (const k in p.texs) p.texs[k] = B + p.texs[k];\n' +
    '  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;\n' +
    '  return p;\n})(' + JSON.stringify(pack) + '));\n';
  fs.writeFileSync(OUT, body);
  fs.writeFileSync(MANIFEST, JSON.stringify([path.basename(OUT)], null, 1));
  const geoBytes = emitted.reduce((s, r) => s + fs.statSync(path.join(ROOT, r)).size, 0);
  const texBytes = texKeep.reduce((s, r) => s + fs.statSync(path.join(ROOT, r)).size, 0);
  console.log('---\n%s: %d poles + %d levels; %s scanned -> %s in the bases + %s in the levels; geometry %s MB, maps %s MB%s%s',
    path.relative(ROOT, OUT), order.length, lodOrder.length, tris0.toLocaleString(), trisBase.toLocaleString(), trisLv.toLocaleString(),
    (geoBytes / 1048576).toFixed(2), (texBytes / 1048576).toFixed(2),
    goneGeo.length ? ' · pruned ' + goneGeo.length + ' bin(s)' : '', goneTex.length ? ' · pruned ' + goneTex.length + ' map(s)' : '');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { SHEET, levelsFor, baseFor };
