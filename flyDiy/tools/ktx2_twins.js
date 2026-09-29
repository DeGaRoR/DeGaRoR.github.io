#!/usr/bin/env node
// ktx2_twins.js - THE KTX2 TWINS OF THE PLAIN MAPS (AS3, G916; futureDesigns/ASSETS-2026-09-27.md §5.3 M8).
//
// A family's maps stay exactly as their baker wrote them (JPEG / PNG, media/tex/<family>/, [[import-models-as-is]]);
// beside each map this writes its KTX2 TWIN - the SAME texels (the shipped file, decoded as the browser decodes it:
// tools/media_lib.py decode_rgba), encoded in the media_lib role of the slot the material reads it in - and a table the
// page reads (src/viewer/ktx2_twins.js). The page takes the twin when it can (src/viewer/props.js propTexture: the
// transcode in the workers, the texture upgraded in place) and the map when it cannot, or when the twin is stale (the
// table is keyed by the map's own hashed name: a re-baked map is a new name, and has no twin until this runs again).
//
// THE TWINS LIVE IN THEIR OWN DIRECTORY, media/tex/ktx2/<family>/ (this tool owns it and prunes it): the family's
// baker prunes media/tex/<family>/ of what IT did not write, and must never see these.
//
// THE ROLES, from the slot every material record names the map in (the packs' mats):
//   map, emisMap  ktx2-color, mips averaged in linear light (an sRGB texture's own), alpha kept when the map has any;
//                 ETC1S unless it fails GATE KTX2's bar on this map (level 0 within 25 dB / 1.5 codes of mean, every
//                 mip down to 16 px within 2.5 codes of the GPU's own - BAR says why not to 1 px) - then UASTC
//   nor           ktx2-normal (UASTC + RDO, linear; three reads rgb)
//   arm           ktx2-data, 3 channels (UASTC, linear: occlusion / roughness / metalness are unrelated channels)
// A map a record reads in two slot kinds gets a twin per kind. Sizes must be multiples of 4 (the block size); a map
// that is not keeps no twin (it stays an image, and says so).
//
//   node tools/ktx2_twins.js [--family pier,props] [--report] [--jobs 3]
// Needs python + Pillow (the decode) and basisu v1.16.4 (npm install in flyDiy/). Committed: the twins and the table.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const K = require('./_ktx2_lib.js');
const { decodeRGBA, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const REPORT = argv.includes('--report');
const JOBS = +opt('jobs', 3);
const OUT = path.join(ROOT, 'src', 'viewer', 'ktx2_twins.js');
// the families: where their packs are listed, where their maps live
const FAMILIES = {
  pier: { packs: 'src/pier/pier_packs.json', dir: 'media/tex/pier' },
  props: { packs: 'src/props/props_packs.json', dir: 'media/tex/props' },
};
const WANT = opt('family', Object.keys(FAMILIES).join(',')).split(',').filter(f => FAMILIES[f]);
// which slot kinds get twins (--kinds color: the colour maps only - their wire is the JPEG's; normal and data twins
// are UASTC, 2-3x their JPEG on the wire for their quarter of the GPU memory: the user's call, HANDOVER G919)
const KINDS = opt('kinds', 'color,normal,data').split(',');
const KIND = { map: 'color', emisMap: 'color', nor: 'normal', arm: 'data' };
const ROLE = {
  color: alpha => [{ role: 'ktx2-color', opts: Object.assign({ mip: 'srgb' }, alpha ? { alpha: true } : {}) }, { role: 'ktx2-color', opts: Object.assign({ mip: 'srgb', codec: 'uastc' }, alpha ? { alpha: true } : {}) }],
  // the normal and data twins: UASTC at RDO lambda 3 over a 32 KB dictionary (lambda 1: +15-20 % of wire for +2-3 dB
  // over a JPEG source that is itself lossy; measured on the pier's maps)
  normal: () => [{ role: 'ktx2-normal', opts: { rdo: 3, dict: 32768 } }],
  data: () => [{ role: 'ktx2-data', opts: { channels: 3, rdo: 3, dict: 32768 } }],
};
// GATE KTX2's bar (tools/_ktx2_check.js: FLOOR, MEAN0, MEANM) - the one both use - with one difference from the
// ground's: the mips are held down to 16 px (minMip), not to 1. A level under 16 px is four 4x4 blocks or fewer, where
// ETC1S's 5-bit endpoints move the mean by up to ~7 codes (measured on the pier's maps: level 0 33-39 dB, every mip
// to 16 px within 1.5 codes, the 8 / 4 / 2 / 1 px levels 2-7 codes off). A prop map is one object's, and at that level
// the object is a few pixels on screen; the ground's maps TILE, so their far mips cover the view, and the ground holds
// every level (and is UASTC for it: G916).
const BAR = { psnr: 25, mean0: 1.5, meanM: 2.5, minMip: 16 };

// every (map, kind) the family's material records read
function wanted(fam) {
  const F = FAMILIES[fam], packs = [];
  const c = { registerPropPack: p => packs.push(p), FLYDIY_ASSET_BASE: '' };
  for (const f of JSON.parse(fs.readFileSync(path.join(ROOT, F.packs), 'utf8'))) vm.runInNewContext(fs.readFileSync(path.join(ROOT, path.dirname(F.packs), f), 'utf8'), c);
  const out = new Map();   // key 'rel|kind' -> { rel, kind }
  for (const P of packs) for (const k in P.props) for (const m of Object.values(P.props[k].mats || {})) for (const slot of Object.keys(KIND)) {
    const id = m[slot]; if (typeof id !== 'string') continue;   // a flat constant (AS0b) has no file
    const rel = P.texs[id]; if (typeof rel !== 'string' || !rel.startsWith(F.dir + '/')) continue;   // (G903: a flat map's texs entry is its [r, g, b])
    out.set(rel + '|' + KIND[slot], { rel, kind: KIND[slot] });
  }
  return [...out.values()].sort((a, b) => (a.rel + a.kind).localeCompare(b.rel + b.kind));
}
// the bar, measured on a decoded KTX2 against its source
async function meets(bytes, rgba, w, h, srgbMip) {
  const d = await K.decode(bytes);
  const L0 = d.mips[0].data;
  const r = { rgb: K.psnr(L0, rgba, [0, 1, 2]), a: K.psnr(L0, rgba, [3]), mean0: K.meanDrift(L0, rgba, [0, 1, 2, 3]), meanM: 0, levels: d.levels, codec: d.uastc ? 'UASTC' : 'ETC1S' };
  let ref = { w, h, data: rgba };
  for (let l = 1; l < d.levels; l++) { ref = K.boxMip(ref.data, ref.w, ref.h, srgbMip); if (Math.min(ref.w, ref.h) < BAR.minMip) break; r.meanM = Math.max(r.meanM, K.meanDrift(d.mips[l].data, ref.data, [0, 1, 2, 3])); }
  r.ok = r.rgb >= BAR.psnr && r.a >= BAR.psnr && r.mean0 <= BAR.mean0 && r.meanM <= BAR.meanM;
  return r;
}

if (require.main !== module) { module.exports = { FAMILIES, KIND, BAR, wanted, meets }; return; }
(async () => {
  if (!K.hasEncoder()) { console.error('ktx2_twins: no basisu v' + K.BASISU_VERSION + ' (cd flyDiy && npm install)'); process.exit(1); }
  // the table as it stands (a family not asked for keeps its rows)
  let table = {};
  if (fs.existsSync(OUT)) { const c = {}; vm.runInNewContext(fs.readFileSync(OUT, 'utf8') + '\nthis.T = KTX2_TWINS_TABLE;', c); table = JSON.parse(JSON.stringify(c.T)); }
  for (const k of Object.keys(table)) if (WANT.includes(table[k].fam)) delete table[k];
  const t0 = Date.now(), stats = {};
  for (const fam of WANT) {
    const list = wanted(fam).filter(x => KINDS.includes(x.kind));
    const dec = decodeRGBA(list.map(x => path.join(ROOT, x.rel)));
    const S = stats[fam] = { maps: list.length, twins: 0, etc1s: 0, uastc: 0, skipped: [], encoded: 0, srcBytes: 0, bytes: 0 };
    const emitted = [];
    // ONE COPY (writeMedia's fold, G901): two maps whose texels decode the same (the pier ships a few such pairs under
    // other JPEG bytes) share one twin - the name's hash is the texels' + role's, so the first stem in list order keeps it
    const byHash = new Map();
    let next = 0;
    const work = async () => {
      for (let i = next++; i < list.length; i = next++) {
        const { rel, kind } = list[i], im = dec[i];
        if (im.w % 4 || im.h % 4) { S.skipped.push(rel + ' (' + im.w + 'x' + im.h + ')'); continue; }
        let alpha = false; if (kind === 'color') for (let q = 3; q < im.data.length; q += 4) if (im.data[q] !== 255) { alpha = true; break; }
        const stem = path.basename(rel).replace(/(\.[0-9a-f]{8})?\.\w+$/, '') + (kind === 'color' ? '' : '_' + kind);
        let got = null;
        const cands = ROLE[kind](alpha);
        for (const cand of cands) {
          const h8 = K.ktx2Hash(im.data, im.w, im.h, cand.role, cand.opts);
          const trel = byHash.get(h8) || `media/tex/ktx2/${fam}/${stem}.${h8}.ktx2`, abs = path.join(ROOT, trel);
          if (!byHash.has(h8)) byHash.set(h8, trel);
          let bytes = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
          if (!bytes) { if (REPORT) { got = { trel, cand, bytes: null }; break; } bytes = await K.encodeRGBAAsync(im.data, im.w, im.h, cand.role, cand.opts, 2); S.encoded++; }
          const m = await meets(bytes, im.data, im.w, im.h, kind === 'color');
          if (m.ok || cand === cands[cands.length - 1]) { got = { trel, cand, bytes, m }; if (!m.ok) got.fail = m; break; }
        }
        if (!got || got.fail) { S.skipped.push(rel + ' (' + (got && got.fail ? 'below the bar: ' + got.fail.rgb.toFixed(1) + ' dB, mip ' + got.fail.meanM.toFixed(1) : 'none') + ')'); continue; }
        if (got.bytes && !REPORT) { fs.mkdirSync(path.dirname(path.join(ROOT, got.trel)), { recursive: true }); if (!fs.existsSync(path.join(ROOT, got.trel))) fs.writeFileSync(path.join(ROOT, got.trel), got.bytes); }
        // the map's mean sRGB colour (every texel, straight): scenery_life's far boxes read it where they drew the image
        let mr = 0, mg = 0, mb = 0; const np = im.w * im.h; for (let q = 0; q < im.data.length; q += 4) { mr += im.data[q]; mg += im.data[q + 1]; mb += im.data[q + 2]; }
        table[rel + '|' + kind] = { fam, twin: got.trel, role: got.cand.role, opts: got.cand.opts, codec: got.m ? got.m.codec : '?', w: im.w, h: im.h, mean: [mr, mg, mb].map(v => +(v / np).toFixed(1)) };
        emitted.push(got.trel); S.twins++; if (got.m && got.m.codec === 'UASTC') S.uastc++; else S.etc1s++;
        S.srcBytes += fs.statSync(path.join(ROOT, rel)).size; if (got.bytes) S.bytes += got.bytes.length;
        if ((S.twins % 25) === 0) process.stdout.write(`  ${fam}: ${S.twins} / ${list.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
      }
    };
    await Promise.all(Array.from({ length: JOBS }, work));
    if (!REPORT) { const gone = pruneMedia('tex/ktx2/' + fam, emitted); if (gone.length) S.pruned = gone.length; }
  }
  if (REPORT) { console.log('--report: ' + JSON.stringify(stats)); return; }
  const keys = Object.keys(table).sort();
  const body = `// GENERATED FILE - DO NOT EDIT. Built by tools/ktx2_twins.js (AS3, G916): the KTX2 TWINS of the plain maps -
// the same texels as the map, encoded in the role of the slot the material reads it in (basisu v${K.BASISU_VERSION}),
// under media/tex/ktx2/<family>/. Keyed by the MAP's own hashed path + the slot kind (color: map / emisMap, normal: nor,
// data: arm): a re-baked map is a new name with no row, and the page loads the map itself (src/viewer/props.js
// propTexture). { fam, twin, role, opts (the role's, as named), codec, w, h, mean: the map's mean sRGB colour }.
const KTX2_TWINS_TABLE = {
${keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])},`).join('\n')}
};
// the page's lookup: (a map's url as the page holds it, the slot kind) -> the twin's url (+ its size, codec and alpha:
// MATLIB's array pages, AS4a-rest G941), or null
const KTX2_TWINS = (() => {
  ${BASE_DECL}
  return (url, kind) => { const k = (B && url.indexOf(B) === 0 ? url.slice(B.length) : url) + '|' + kind; const r = KTX2_TWINS_TABLE[k]; return r ? { url: B + r.twin, fam: r.fam, mean: r.mean, w: r.w, h: r.h, codec: r.codec, alpha: !!(r.opts && r.opts.alpha) } : null; };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { KTX2_TWINS_TABLE };
`;
  fs.writeFileSync(OUT, body);
  const MB = x => (x / 1048576).toFixed(1);
  for (const [f, S] of Object.entries(stats)) console.log(`${f}: ${S.maps} (map, kind) pairs -> ${S.twins} twins (${S.etc1s} ETC1S, ${S.uastc} UASTC; ${S.encoded} encoded this run), ${MB(S.bytes)} MB of twins for ${MB(S.srcBytes)} MB of maps${S.pruned ? ', pruned ' + S.pruned : ''}; no twin: ${S.skipped.length}${S.skipped.length ? ' - ' + S.skipped.slice(0, 5).join(', ') : ''}`);
  console.log(`src/viewer/ktx2_twins.js: ${keys.length} rows (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
