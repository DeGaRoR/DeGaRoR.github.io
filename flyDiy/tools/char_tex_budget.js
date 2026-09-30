#!/usr/bin/env node
// char_tex_budget.js - THE CHARACTERS' TEXTURE BUDGET (AS6, G935-G936; futureDesigns/ASSETS-2026-09-27.md §5.3 M12).
//
// WHY. A seated Mixamo character drew 2048^2 RGBA8 maps (diffuse + normal per material, the GPU's mips on top: 21.3 MiB
// each) for a body the chase and cockpit views put a metre or ten from the eye, and carried two more 2048^2 maps per
// material in its manifest (the Glossiness map, and a Specular map that is flat white on every character). The user's
// yes (2026-09-29): "what we can't do is harsh decimation without a proper asset prep pipeline, but modifying texture
// sizes and formats is perfectly OK" - this is that pipeline's texture half. The GEOMETRY is untouched.
//
// WHAT. tools/chars_table.py TEX_BUDGET declares it. Per character, per material (src/chars/<key>_char.js mats):
//   map          -> ONE diffuse plane, `size`^2, ktx2-color in UASTC (alpha kept where the map has any: the hair cards)
//   nrm + mr     -> ONE normal plane, `size`^2, ktx2-normal: RGB = the normal, A = the Glossiness map's G channel
//                   (N.a; a material without a gloss map reads the plane's RGB only)
//   spec         -> a CONSTANT (the map's mean colour; every one is flat white - GATE ASSETS' FLAT)
//   a flat plane -> a constant too (Ch02's hair normal is (128, 127, 255) everywhere: no normal map at all)
// A plane is cut from the 2048 map the page loads today (media/tex/chars/<key>/, decoded as the browser decodes it:
// media_lib.py decode_rgba) by a 2x2 box per halving - in linear light for the sRGB diffuse, on the stored values for the
// normal and the gloss: exactly the texels of that map's GPU mip 1 (the old path's own generateMipmap). So wherever the
// old path sampled level 1 or coarser, the new file holds the same texels (to the encoder's PSNR); only level 0 - the
// 2048 detail - is gone. A map already at or under `size` (Remy's 1024 / 512 maps) is taken as it is.
//
// WHERE. media/tex/ktx2/chars/ (this tool owns it and prunes it: char_prep.py prunes media/tex/chars/<key>/ of what IT
// wrote and never sees these), named by the plane's texels + role (tools/_ktx2_lib.js ktx2Name): an unchanged plane is
// never re-encoded. src/chars/chars_ktx2.js is the table the page reads (tools/_cage_char.js): per character, per
// material, the files and the constants, and the 2048 maps each was cut from - a character re-baked from its GLB has
// new map names, its rows no longer match, and the page loads the 2048 maps (the old path) until this runs again.
// THE BAR (GATE KTX2's, per file, re-measured by the gate's check 10): level 0 vs the plane >= 25 dB on rgb and alpha,
// every channel's mean within 1.5 codes, every mip down to 16 px within 2.5 codes of the GPU's own generateMipmap of the
// plane, and - for the skin - no 32 px tile's mean (rgb, opaque texels) moved more than TILE codes.
//
//   node tools/char_tex_budget.js [--report] [--jobs 3]
// Needs python + Pillow (the decode) and basisu v1.16.4 (npm install in flyDiy/). tools/char_prep.py runs it last.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const K = require('./_ktx2_lib.js');
const { decodeRGBA, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const DIR = 'media/tex/ktx2/chars';
const OUT = path.join(ROOT, 'src', 'chars', 'chars_ktx2.js');
const BAR = { psnr: 25, mean0: 1.5, meanM: 2.5, minMip: 16, tile: 2.0, tilePx: 32 };

// the declared budget (tools/chars_table.py TEX_BUDGET) - python is this tool's dependency anyway (the decode)
function budget() {
  for (const py of ['python', 'python3', 'py']) {
    const r = cp.spawnSync(py, ['-c', 'import sys, json; sys.path.insert(0, sys.argv[1]); import chars_table as T; print(json.dumps(T.TEX_BUDGET))', __dirname], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return JSON.parse(r.stdout);
  }
  throw new Error('char_tex_budget: cannot read tools/chars_table.py TEX_BUDGET (python)');
}
// the character manifests char_prep wrote, in its order
function manifests() {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'chars', 'chars_index.json'), 'utf8')).filter(f => /_char\.js$/.test(f));
  const out = [];
  const ctx = { registerChar: c => out.push(c), FLYDIY_ASSET_BASE: '' };
  for (const f of idx) vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'chars', f), 'utf8'), ctx);
  return out;
}
// halve until the largest side is `size` (the GPU's generateMipmap: srgb -> the rgb averaged in linear light)
function cut(im, size, srgb) {
  let r = { w: im.w, h: im.h, data: new Uint8Array(im.data.buffer, im.data.byteOffset, im.data.byteLength) };
  while (Math.max(r.w, r.h) > size) r = K.boxMip(r.data, r.w, r.h, srgb);
  return r;
}
// every channel's std at 256 px (the census's FLAT test: a BOX resample to 256, then the stddev)
function flatStd(im) {
  let r = cut(im, 256, false);
  const n = r.w * r.h, s = [0, 0, 0, 0], q = [0, 0, 0, 0];
  for (let i = 0; i < r.data.length; i += 4) for (let c = 0; c < 4; c++) { s[c] += r.data[i + c]; q[c] += r.data[i + c] * r.data[i + c]; }
  return s.map((v, c) => Math.sqrt(Math.max(0, q[c] / n - (v / n) * (v / n))));
}
const meanOf = im => { const s = [0, 0, 0, 0], n = im.w * im.h; for (let i = 0; i < im.data.length; i += 4) for (let c = 0; c < 4; c++) s[c] += im.data[i + c]; return s.map(v => +(v / n).toFixed(1)); };
// the worst 32 px tile's mean drift over rgb, opaque texels only (a local tone shift - a face - the whole-map mean hides)
function tileDrift(a, b, w, h, T) {
  let worst = 0;
  for (let ty = 0; ty < h; ty += T) for (let tx = 0; tx < w; tx += T) for (let c = 0; c < 3; c++) {
    let sa = 0, sb = 0, n = 0;
    for (let y = ty; y < Math.min(h, ty + T); y++) for (let x = tx; x < Math.min(w, tx + T); x++) { const i = (y * w + x) * 4; if (b[i + 3] < 128) continue; sa += a[i + c]; sb += b[i + c]; n++; }
    if (n > T * T / 2) worst = Math.max(worst, Math.abs(sa - sb) / n);
  }
  return worst;
}
// the bar, measured on a decoded file against its plane
async function measure(bytes, plane, srgb) {
  const d = await K.decode(bytes);
  const L0 = d.mips[0].data;
  const r = { rgb: +K.psnr(L0, plane.data, [0, 1, 2]).toFixed(2), a: +K.psnr(L0, plane.data, [3]).toFixed(2), mean0: +K.meanDrift(L0, plane.data, [0, 1, 2, 3]).toFixed(2), meanM: 0,
    tile: +tileDrift(L0, plane.data, plane.w, plane.h, BAR.tilePx).toFixed(2), levels: d.levels, codec: d.uastc ? 'UASTC' : 'ETC1S', w: d.width, h: d.height, srgb: d.srgb };
  let ref = plane;
  for (let l = 1; l < d.levels; l++) { ref = K.boxMip(ref.data, ref.w, ref.h, srgb); if (Math.min(ref.w, ref.h) < BAR.minMip) break; r.meanM = Math.max(r.meanM, K.meanDrift(d.mips[l].data, ref.data, [0, 1, 2, 3])); }
  r.meanM = +r.meanM.toFixed(2);
  r.ok = r.rgb >= BAR.psnr && r.a >= BAR.psnr && r.mean0 <= BAR.mean0 && r.meanM <= BAR.meanM && (!srgb || r.tile <= BAR.tile);
  return r;
}
const stemOf = rel => path.basename(rel).replace(/(\.[0-9a-f]{8})?\.\w+$/, '');
const RGBA8 = (w, h) => Math.round(w * h * 4 * 4 / 3);          // an image texture: RGBA8 + the GPU's mips
const BC7 = (w, h) => { let n = 0; for (let W = w, H = h; ; W = Math.max(1, W >> 1), H = Math.max(1, H >> 1)) { n += Math.ceil(W / 4) * Math.ceil(H / 4) * 16; if (W === 1 && H === 1) break; } return n; };

// THE PLAN: per character, the planes its materials need (pure: the gate re-derives it) -> { planes, mats, before }
// G939.1 (train 17, AS6 x AS0b): since AS0b (G903) a manifest's texs entry is a FILE (a string) or a flat map's CONSTANT
// ([r, g, b], 0-255, no file on disk). A constant is never decoded, cut or listed as a src; it goes into the row as
// the constant this budget would have made of the flat map anyway (spec -> row.spec, a flat normal -> row.nrmConst)
const isFile = v => typeof v === 'string';
function plan(c, TB, dec) {
  const planes = new Map();      // key -> { kind, src: [rel...], build: () => { w, h, data } }
  const flat = rel => { const s = flatStd(dec(rel)); return Math.max(...s) < TB.flat; };
  // the gloss a normal carries: the first material that pairs it with one (a gloss-less material that shares the
  // normal - Ch42's and Ch01's hair - reads the same plane's RGB and ignores its A)
  const glossFor = {};
  if (TB.gloss === 'N.a') for (const m of c.mats) if (m.nrm && m.mr && isFile(c.texs[m.nrm]) && isFile(c.texs[m.mr]) && !glossFor[c.texs[m.nrm]]) glossFor[c.texs[m.nrm]] = c.texs[m.mr];
  const mats = c.mats.map((m, mi) => {
    const row = { src: {} };
    for (const k of ['map', 'nrm', 'mr', 'spec']) if (m[k]) row.src[k] = c.texs[m[k]];   // (a constant too: the page's staleness test compares the manifest's value)
    if (m.map && !isFile(c.texs[m.map])) throw new Error(`${c.key}: ${m.name}'s diffuse is a constant - not written yet`);
    if (m.map) {
      const rel = c.texs[m.map], key = 'c|' + rel;
      if (!planes.has(key)) planes.set(key, { kind: 'color', stem: stemOf(rel), src: [rel], build: () => cut(dec(rel), TB.size, true) });
      row.map = key;
    }
    if (m.nrm && !isFile(c.texs[m.nrm])) row.nrmConst = c.texs[m.nrm].slice(0, 3);   // G939.1: AS0b's flat normal constant
    else if (m.nrm) {
      const nrel = c.texs[m.nrm], own = TB.gloss === 'N.a' && m.mr && isFile(c.texs[m.mr]) ? c.texs[m.mr] : null, grel = own || glossFor[nrel] || null;
      if (own && own !== glossFor[nrel]) throw new Error(`${c.key}: ${nrel} is paired with two gloss maps (${glossFor[nrel]}, ${own}) - one plane each is not written yet`);
      if (!grel && flat(nrel)) row.nrmConst = meanOf(dec(nrel)).slice(0, 3);       // a flat normal: no map at all
      else {
        const key = 'n|' + nrel + '|' + (grel || '');
        if (!planes.has(key)) planes.set(key, { kind: 'normal', stem: stemOf(nrel) + (grel ? '_ng' : ''), src: grel ? [nrel, grel] : [nrel], build: () => {
          const n = cut(dec(nrel), TB.size, false), out = new Uint8Array(n.data);
          if (grel) {
            const g = cut(dec(grel), TB.size, false);
            if (g.w !== n.w || g.h !== n.h) throw new Error(`${c.key}: gloss ${grel} is ${g.w}x${g.h}, its normal ${n.w}x${n.h}`);
            for (let i = 3; i < out.length; i += 4) out[i] = g.data[i - 2];          // N.a = the gloss map's G
          } else for (let i = 3; i < out.length; i += 4) out[i] = 255;
          return { w: n.w, h: n.h, data: out };
        } });
        row.nrm = key; if (own) row.gloss = 1;
      }
    }
    if (m.spec && TB.spec === 'const' && !isFile(c.texs[m.spec])) { row.spec = c.texs[m.spec].slice(0, 3).map(v => +(v / 255).toFixed(3)); row.specStd = 0; }   // G939.1
    else if (m.spec && TB.spec === 'const') { const s = flatStd(dec(c.texs[m.spec])); row.spec = meanOf(dec(c.texs[m.spec])).slice(0, 3).map(v => +(v / 255).toFixed(3)); row.specStd = +Math.max(...s.slice(0, 3)).toFixed(2); }
    return row;
  });
  return { planes, mats };
}
// what a character costs on the GPU, the old path (image textures the material binds: map + normalMap) and the budget
function gpuOld(c, dims) {
  const bound = new Set(), all = new Set();
  for (const m of c.mats) { for (const k of ['map', 'nrm']) if (m[k] && isFile(c.texs[m[k]])) bound.add(c.texs[m[k]]); for (const k of ['map', 'nrm', 'mr', 'spec']) if (m[k] && isFile(c.texs[m[k]])) all.add(c.texs[m[k]]); }
  const sum = set => [...set].reduce((s, rel) => s + RGBA8(dims(rel).w, dims(rel).h), 0);
  return { bound: sum(bound), boundN: bound.size, all: sum(all), allN: all.size };
}

if (require.main !== module) { module.exports = { BAR, DIR, budget, manifests, plan, cut, measure, tileDrift, flatStd, gpuOld, RGBA8, BC7 }; return; }
(async () => {
  const argv = process.argv.slice(2), REPORT = argv.includes('--report');
  const JOBS = +((argv[argv.indexOf('--jobs') + 1]) || 3) || 3;
  if (!REPORT && !K.hasEncoder()) { console.error('char_tex_budget: no basisu v' + K.BASISU_VERSION + ' (cd flyDiy && npm install)'); process.exit(1); }
  const TB = budget(), chars = manifests(), t0 = Date.now();
  // decode every map a manifest names, once (python, one process)
  const rels = [...new Set(chars.flatMap(c => Object.values(c.texs).filter(isFile)))].sort();
  const D = decodeRGBA(rels.map(r => path.join(ROOT, r)));
  const byRel = new Map(rels.map((r, i) => [r, D[i]]));
  const dec = rel => { const d = byRel.get(rel); if (!d) throw new Error('not decoded: ' + rel); return d; };
  const table = {}, emitted = [], byHash = new Map(), jobs = [], refused = [], sum = { files: 0, bytes: 0, encoded: 0 };
  for (const c of chars) {
    const P = plan(c, TB, dec);
    const T = table[c.key] = { mats: P.mats, files: {} };
    for (const [key, pl] of P.planes) jobs.push({ c, T, key, pl });
  }
  let next = 0;
  const work = async () => {
    for (let i = next++; i < jobs.length; i = next++) {
      const { c, T, key, pl } = jobs[i];
      const im = pl.build();
      if (im.w % 4 || im.h % 4) throw new Error(`${c.key}: ${key} is ${im.w}x${im.h} (not a multiple of the 4x4 block)`);
      let alpha = false; if (pl.kind === 'color') for (let q = 3; q < im.data.length; q += 4) if (im.data[q] !== 255) { alpha = true; break; }
      const role = pl.kind === 'color' ? TB.color : TB.normal;
      // the candidates, cheapest first: the diffuse in ETC1S where it meets the bar ON THIS MAP (the skin tile included),
      // else UASTC (TB.colorCodec 'auto'; 'uastc' = UASTC only); the normal in its role's one setting
      const A = alpha ? { alpha: true } : {};
      const cands = pl.kind !== 'color' ? [{}] : TB.colorCodec === 'uastc' ? [Object.assign({ mip: 'srgb', codec: 'uastc' }, A)]
        : [Object.assign({ mip: 'srgb' }, A), Object.assign({ mip: 'srgb', codec: 'uastc' }, A)];
      let got = null;
      for (const opts of cands) {
        const h8 = K.ktx2Hash(im.data, im.w, im.h, role, opts);
        if (!byHash.has(h8)) byHash.set(h8, { rel: `${DIR}/${pl.stem}.${h8}.ktx2`, p: null });
        const H = byHash.get(h8), abs = path.join(ROOT, H.rel);
        // ONE ENCODE PER NAME: two materials cutting the same texels (Remy's eyelashes read his body's diffuse under a second
        // name) share the file, and the second waits for the first's encode instead of racing it
        if (!H.p) H.p = (async () => {
          let bytes = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
          if (!bytes && REPORT) return null;
          if (!bytes) { bytes = await K.encodeRGBAAsync(im.data, im.w, im.h, role, opts, 2); sum.encoded++; }
          return { bytes, q: await measure(bytes, im, pl.kind === 'color') };
        })();
        const r = await H.p;
        if (!r) { got = { rel: H.rel, opts, bytes: null }; break; }
        if (r.q.ok || opts === cands[cands.length - 1]) { got = { rel: H.rel, opts, bytes: r.bytes, q: r.q }; break; }
        refused.push(`${pl.stem} ${r.q.codec}: rgb ${r.q.rgb} dB, a ${r.q.a}, mean ${r.q.mean0}, mips ${r.q.meanM}, tile ${r.q.tile}`);
      }
      if (!got.bytes) { T.files[key] = { url: got.rel, role, opts: got.opts, w: im.w, h: im.h, src: pl.src, bytes: null }; continue; }
      const { rel, opts, bytes, q } = got, abs = path.join(ROOT, rel);
      if (!q.ok) throw new Error(`${c.key}: ${rel} below the bar: ${JSON.stringify(q)}`);
      if (!REPORT && !fs.existsSync(abs)) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, bytes); }
      T.files[key] = { url: rel, role, opts, codec: q.codec, w: im.w, h: im.h, src: pl.src, bytes: bytes.length, gpu: K.gpuBytesOf(bytes),
        q: { rgb: q.rgb, a: q.a, mean0: q.mean0, meanM: q.meanM, tile: q.tile } };
      if (!emitted.includes(rel)) { emitted.push(rel); sum.files++; sum.bytes += bytes.length; }
      process.stdout.write(`  ${c.key.padEnd(5)} ${path.basename(rel).padEnd(44)} ${q.codec} ${im.w}x${im.h} ${(bytes.length / 1048576).toFixed(2)} MB  rgb ${q.rgb} dB  a ${q.a}  mean ${q.mean0}  mips ${q.meanM}  tile ${q.tile}  (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
  };
  await Promise.all(Array.from({ length: JOBS }, work));
  if (refused.length) console.log(`\nrefused (below the bar on that map; the next candidate taken):\n  ${[...new Set(refused)].sort().join('\n  ')}`);
  // the materials name their files by url (the table is what the page reads)
  const MiB = x => (x / 1048576).toFixed(1);
  const dims = rel => dec(rel);
  console.log('\nper character (GPU: RGBA8 + mips for an image; BC7 for a KTX2 on a desktop):');
  for (const c of chars) {
    const T = table[c.key], o = gpuOld(c, dims);
    const urls = new Set();
    for (const m of T.mats) { if (m.map) m.map = T.files[m.map].url; if (m.nrm) m.nrm = T.files[m.nrm].url; }
    for (const f of Object.values(T.files)) urls.add(f.url);
    const files = {}; for (const f of Object.values(T.files)) files[f.url] = f;
    T.files = files;
    T.gpu = { old: o.bound, oldN: o.boundN, oldAll: o.all, oldAllN: o.allN, new: [...urls].reduce((s, u) => s + (files[u].gpu || BC7(files[u].w, files[u].h)), 0), newN: urls.size,
      wireOld: [...new Set(c.mats.flatMap(m => [m.map, m.nrm].filter(Boolean).map(t => c.texs[t]).filter(isFile)))].reduce((s, r) => s + fs.statSync(path.join(ROOT, r)).size, 0),
      wireNew: [...urls].reduce((s, u) => s + (files[u].bytes || 0), 0) };
    console.log(`  ${c.key.padEnd(5)} bound ${o.boundN} maps ${MiB(o.bound)} MiB (all ${o.allN} in the manifest: ${MiB(o.all)}) -> ${T.gpu.newN} files ${MiB(T.gpu.new)} MiB; wire ${MiB(T.gpu.wireOld)} -> ${MiB(T.gpu.wireNew)} MiB`);
  }
  if (REPORT) { console.log('--report: nothing written'); return; }
  const gone = pruneMedia('tex/ktx2/chars', emitted);
  const keys = Object.keys(table);
  const body = `// GENERATED FILE - DO NOT EDIT. Built by tools/char_tex_budget.js (AS6, G935) from tools/chars_table.py TEX_BUDGET
// (size ${TB.size}, diffuse ${TB.color}${TB.colorCodec ? ' ' + TB.colorCodec : ''}, normal ${TB.normal} + gloss in ${TB.gloss}, spec ${TB.spec}; basisu v${K.BASISU_VERSION}):
// THE CHARACTERS' TEXTURE BUDGET, per character, per material (the manifest's mats, in order) - map / nrm: the KTX2
// files (media/tex/ktx2/chars/), gloss: 1 when the normal's alpha carries the material's Glossiness map, nrmConst: a
// flat normal (no map), spec: the flat specular as a constant; src: the 2048 maps each was cut from (a re-baked character
// has other names: its rows no longer match and tools/_cage_char.js loads the maps themselves). files: each file's
// role, size and its bar as measured (GATE KTX2 check 10 re-measures). gpu: bytes per character, old (the bound maps
// as RGBA8 + mips) and new (BC7), and the wire of each.
const CHAR_KTX2_TABLE = {
${keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])},`).join('\n')}
};
// the page's lookup: a character's key -> its budget row with the urls rooted, or null
const CHAR_KTX2 = (() => {
  ${BASE_DECL}
  const U = u => (typeof u === 'string' && u ? B + u : u);   // (G939.1: a flat map's constant [r, g, b] passes as it is)
  return key => { const r = CHAR_KTX2_TABLE[key]; if (!r) return null;
    return { mats: r.mats.map(m => Object.assign({}, m, { map: U(m.map), nrm: U(m.nrm), src: Object.fromEntries(Object.entries(m.src).map(([k, v]) => [k, U(v)])) })) }; };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { CHAR_KTX2_TABLE };
`;
  fs.writeFileSync(OUT, body);
  // the page reads the table from the MODELS slot, behind the manifests (char_prep writes the index; a run of this tool
  // alone keeps it in step)
  const idxF = path.join(ROOT, 'src', 'chars', 'chars_index.json');
  const idx = JSON.parse(fs.readFileSync(idxF, 'utf8'));
  if (!idx.includes('chars_ktx2.js')) { idx.push('chars_ktx2.js'); fs.writeFileSync(idxF, JSON.stringify(idx) + '\n'); }
  console.log(`\n${DIR}: ${sum.files} files, ${MiB(sum.bytes)} MiB (${sum.encoded} encoded this run${gone.length ? ', pruned ' + gone.length : ''}); src/chars/chars_ktx2.js: ${keys.length} characters (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
