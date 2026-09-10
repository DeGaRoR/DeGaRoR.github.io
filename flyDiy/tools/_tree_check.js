// _tree_check.js — GATE TREES: the baked tree payload decodes to the tree that
// was baked. Run: node tools/_tree_check.js
//
// What it is really guarding. Every fault this pipeline met in the bench looked
// like something else: an atlas keyed on a name outliving its fixes, a bake
// racing texture decode, a tile rect on the wrong object, a cutout threshold
// that was an absolute number over packs on different alpha scales. None of
// those announced itself — each presented as "the tree is missing or wrong".
// So this gate does not check that a file exists; it checks that what comes
// back out is a TREE: standing on the ground, inside its own box, with an AO
// channel that carries information and rungs that share a frame.
'use strict';
const fs = require('fs'), path = require('path');
const { decodeTreePart } = require(path.join(__dirname, '..', 'src', 'core', '53_tree_codec.js'));

const ROOT = path.join(__dirname, '..');
const PACK = path.join(ROOT, 'src', 'core', 'trees_pack.json');
const fail = [];
const note = m => process.stdout.write('  ' + m + '\n');

function check() {
  if (!fs.existsSync(PACK)) { fail.push('no trees_pack.json — run tools/tree_prep.py'); return; }
  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  if (!pack.collections || !pack.collections.length) { fail.push('pack has no collections'); return; }

  let nSub = 0, nRung = 0, nPart = 0, nVert = 0, nTri = 0, bytes = 0;
  for (const C of pack.collections) {
    const bp = path.join(ROOT, ...C.bin.split('/'));
    if (!fs.existsSync(bp)) { fail.push(C.name + ': missing ' + C.bin); continue; }
    const bin = new Uint8Array(fs.readFileSync(bp));
    bytes += bin.length;
    if (bin.length !== C.bytes) fail.push(C.name + ': bin is ' + bin.length + ', pack says ' + C.bytes);
    // the licence must survive the bake — a payload whose provenance was lost
    // is one nobody can ship
    if (!C.licence) fail.push(C.name + ': no licence in the manifest');

    // ---- the maps ------------------------------------------------------
    // A CUTOUT MAP THAT LOST ITS ALPHA IS A SOLID GREEN BOX and nothing else
    // says so: the geometry is fine, the manifest is fine, and the tree draws
    // as a slab. So the PNG header is read and the colour type checked — 6 is
    // RGBA, 4 is grey+alpha, anything else means the channel is gone.
    const mats = C.materials || {};
    for (const [name, M] of Object.entries(mats)) {
      for (const k of ['base', 'nor']) {
        if (!M[k]) continue;
        const fp = path.join(ROOT, ...M[k].split('/'));
        if (!fs.existsSync(fp)) { fail.push(name + ': missing ' + M[k]); continue; }
        if (k === 'base' && M.mode !== 'OPAQUE') {
          const h = fs.readFileSync(fp);
          if (h.slice(1, 4).toString() !== 'PNG')
            fail.push(name + ': cutout map is not a PNG — JPEG cannot carry alpha');
          else if (![4, 6].includes(h[25]))
            fail.push(name + ': cutout map has PNG colour type ' + h[25] + ' — no alpha channel');
        }
      }
      if (M.mode !== 'OPAQUE') {
        if (!(M.cutoff > 0 && M.cutoff < 1))
          fail.push(name + ': cutout with no usable alphaCutoff (' + M.cutoff + ')');
        // the renderer cannot know the threshold coverage must be preserved
        // against unless the material carries it
        if (!M.coverageMips) fail.push(name + ': cutout not flagged for coverage mips');
      }
    }

    for (const S of C.subjects) {
      nSub++;
      const [x0, y0, z0, x1, y1, z1] = S.bb;
      const span = [x1 - x0, y1 - y0, z1 - z0];
      if (!(span[0] > 0 && span[1] > 0 && span[2] > 0)) fail.push(S.name + ': degenerate bb');
      if (Math.abs(y0) > 1e-3) fail.push(S.name + ': base is at y=' + y0 + ', not 0');

      const centres = [];
      for (const R of S.rungs) {
        nRung++;
        let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        let aoMin = 2, aoMax = -1, aoSum = 0, aoN = 0;
        for (const P of R.parts) {
          nPart++;
          let d;
          try { d = decodeTreePart(S.bb, P, bin); }
          catch (e) { fail.push(S.name + ' L' + R.lod + ' ' + P.mat + ': ' + e.message); continue; }
          const nv = d.pos.length / 3;
          nVert += nv; nTri += d.idx.length / 3;
          if (d.idx.length % 3) fail.push(S.name + ': index count not a multiple of 3');
          for (let i = 0; i < d.idx.length; i++) {
            if (d.idx[i] >= nv) { fail.push(S.name + ' ' + P.mat + ': index out of range'); break; }
          }
          for (let i = 0; i < nv; i++) {
            for (let k = 0; k < 3; k++) {
              const v = d.pos[i * 3 + k];
              if (!isFinite(v)) { fail.push(S.name + ': non-finite position'); break; }
              if (v < lo[k]) lo[k] = v;
              if (v > hi[k]) hi[k] = v;
            }
            const a = d.ao[i];
            if (a < aoMin) aoMin = a;
            if (a > aoMax) aoMax = a;
            aoSum += a; aoN++;
          }
          if (!['OPAQUE', 'MASK', 'BLEND'].includes(d.mode))
            fail.push(S.name + ' ' + P.mat + ': odd alphaMode ' + d.mode);
          if (!mats[P.mat]) fail.push(S.name + ': part material "' + P.mat +
            '" is not in the collection materials - its maps were not baked');
        }
        // inside its own box, and actually filling it: a wrong frame or a
        // wrong bb both show up here and nowhere else
        for (let k = 0; k < 3; k++) {
          if (lo[k] < S.bb[k] - 1e-3 || hi[k] > S.bb[k + 3] + 1e-3)
            fail.push(S.name + ' L' + R.lod + ': geometry outside its bb on axis ' + k);
        }
        if (R.lod === S.rungs[0].lod) {
          for (let k = 0; k < 3; k++) {
            if ((hi[k] - lo[k]) < span[k] * 0.9)
              fail.push(S.name + ': finest rung fills only ' +
                (100 * (hi[k] - lo[k]) / span[k]).toFixed(0) + '% of its bb on axis ' + k);
          }
        }
        // An AO channel that is all 1 is a channel that was never baked —
        // EXCEPT on a billboard rung. LOLIPOP's LOD3 is a 20-triangle card
        // with no interior to occlude, and a flat 1 there is the right answer,
        // not a missing bake.
        if (aoN && R.tris > 200) {
          if (aoMax > 1.0001 || aoMin < -1e-6) fail.push(S.name + ': AO outside [0,1]');
          if (aoMax - aoMin < 0.05) fail.push(S.name + ' L' + R.lod + ': AO is flat (' +
            aoMin.toFixed(3) + '..' + aoMax.toFixed(3) + ') — not baked');
          if (aoSum / aoN > 0.995) fail.push(S.name + ' L' + R.lod + ': AO mean is 1 — not baked');
        }
        centres.push([(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2]);
      }
      // every rung shares the subject's frame, or the tree jumps sideways as
      // the ladder switches
      for (let i = 1; i < centres.length; i++) {
        const dx = centres[i][0] - centres[0][0], dz = centres[i][1] - centres[0][1];
        if (Math.hypot(dx, dz) > Math.max(0.25, span[0] * 0.08))
          fail.push(S.name + ': rung ' + i + ' is off-centre by ' + Math.hypot(dx, dz).toFixed(2) + ' m');
      }
    }
  }
  let nMat = 0, texBytes = 0;
  for (const C of pack.collections)
    for (const M of Object.values(C.materials || {})) {
      nMat++;
      for (const k of ['base', 'nor']) {
        if (!M[k]) continue;
        const fp = path.join(ROOT, ...M[k].split('/'));
        if (fs.existsSync(fp)) texBytes += fs.statSync(fp).size;
      }
    }
  note(pack.collections.length + ' collections · ' + nSub + ' subjects · ' + nRung +
       ' rungs · ' + nPart + ' parts · ' + nMat + ' materials');
  note('maps ' + (texBytes / 1e6).toFixed(2) + ' MB');
  note(nVert.toLocaleString() + ' vertices · ' + nTri.toLocaleString() + ' triangles · ' +
       (bytes / 1e6).toFixed(2) + ' MB');
}

try { check(); } catch (e) { fail.push('threw: ' + e.message); }
for (const f of fail) process.stdout.write('  FAIL ' + f + '\n');
process.stdout.write('GATE TREES: ' + (fail.length ? 'FAIL' : 'PASS') + '\n');
process.exit(fail.length ? 1 : 0);
