#!/usr/bin/env node
// _ktx2_check.js - GATE KTX2: EVERY CONVERTED TEXTURE DECODES, AND IS ITS SOURCE WITHIN A STATED PSNR (AS3, G918).
//
// futureDesigns/ASSETS-2026-09-27.md §5.3 M8-M9. The ground library's cooked planes ship as KTX2 (tools/_ktx2_lib.js,
// basisu v1.16.4: kA / kAl colour + height in ETC1S, kN normal + roughness in UASTC + RDO), transcoded in the page's
// workers into a compressed array (src/viewer/ktx2.js, ground_lib.js); the raw planes stay the fallback. This gate
// decodes every KTX2 file IN NODE with the page's own transcoder (vendor/ktx2/basis_transcoder.js + .wasm, three@0.186)
// and holds it to its source, the raw plane the page used before:
//   1. THE VENDOR     vendor/ktx2/: the transcoder is three@0.186's byte for byte (when node_modules has it), and
//                     ktx2_loader.js adds THREE.KTX2Loader over vendor/three.min.js
//   2. THE TABLE      every cooked set has kN, the pavement's sets kA, the splat's kAl (and only those); every file is on
//                     disk; the views hand each library its own variant (pavement kA, splat kAl)
//   3. THE NAMES      each file's name is re-derived from its input - the raw plane's texels + the role's settings + the
//                     encoder's version (ktx2Name) - so a KTX2 file cannot drift from the layer it stands for
//   4. IT DECODES     every file transcodes (every level): px x px, a full mip chain, one layer, ETC1S for colour /
//                     UASTC for normals, alpha present, the DFD's transfer sRGB for colour and linear for normals
//   5. THE TEXELS     level 0 against the raw plane, per role, over the whole library (the floors, and why, below):
//                     PSNR of rgb and of alpha at or above the role's floor, each channel's MEAN within MEAN0 codes
//   6. THE MIPS       every level below 0 against the GPU's own generateMipmap of the raw plane (a 2x2 box: in linear
//                     light for the pavement's sRGB-typed array, on the stored values for the splat's shader-decoded
//                     one and for normals): each channel's mean within MEANM codes - the far look's brightness (the
//                     2026-09-22 "far texels 17-29 % darker" lesson) cannot move under the compression
//   7. THE PAGE       ktx2.js: ?ktx2=0 (and flydiy.ktx2 = '0', no Worker, no WebAssembly, no compressed format) turn it
//                     off; ground_lib.js falls back to the raw layers on any failure; the loader is lazy (build.js
//                     MANIFEST.lazy, no static tag)
//   9. THE TWINS      (python + Pillow present) the plain maps' KTX2 twins (tools/ktx2_twins.js: the pier, the shed's
//                     props): every map a material record reads has its twin, named by the map's decoded texels +
//                     role, decoding to its size with every mip, within the same bar (5-6's) - ETC1S where it meets it,
//                     UASTC where it does not - and the table's mean colour is the map's
//  10. THE CHARACTERS (AS6, G937) the characters' texture budget (tools/char_tex_budget.js, src/chars/chars_ktx2.js):
//                     every character's materials have their rows, cut from the maps their manifests name, each file its
//                     plane's texels + role (re-cut here from the 2048 maps), UASTC, within the bar (the skin's 32 px tiles
//                     too); tools/_cage_char.js on stubs: the set by default, ?ktx2=0 the 2048 maps (the old path), a
//                     stale row or a failed transcode the 2048 map, the gloss (N.a) read only with ?chargloss=1
//   8. THE ENCODER    (basisu v1.16.4 present) N files re-encoded in memory from their raw planes = the shipped bytes
//                     (--full: all of them); reported when absent, never failed (a box without the encoder can gate)
// --selftest breaks 2-7 in turn (a byte flipped in a file, two sets' colour swapped, the splat pointed at the sRGB-mip
// variant, a normal plane encoded as ETC1S, a kN dropped, ?ktx2=0 ignored) - each must be red.
//   node tools/_ktx2_check.js [--selftest] [--full] [--stats]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const K = require('./_ktx2_lib.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const SELF = argv.includes('--selftest'), FULL = argv.includes('--full'), STATS = argv.includes('--stats');
const abs = rel => path.join(ROOT, ...rel.split('/'));

// THE FLOORS (dB), measured on the 54 cooked sets at G918 (worst set in brackets) and set a little under the worst:
// these are photographs of noisy ground (grass blades, gravel), where any 4x4-block codec loses most; the floors catch a
// broken file, a wrong plane, a wrong colour space or a swapped set (all land far below: 8-20 dB), not taste - the look
// is the user's, by eye (HANDOVER G919's recipe, ?ktx2=0 for the A/B).
const FLOOR = {
  'ktx2-color': { rgb: 25, a: 25 },    // ETC1S q255: rgb median 32.0 dB [grass 26.7], height median 34.6 [26.7]
  'ktx2-normal': { rgb: 25, a: 25 },   // UASTC + RDO 1: rgb median 33.0 dB [26.5], roughness median 35.0 [27.8]
};
const MEAN0 = 1.5;   // codes: level 0's per-channel mean vs the raw plane's
// A PLANE THAT MAY DRIFT FURTHER (a decision, HANDOVER G940): a set whose roughness became a CONSTANT under G903 (train 16
// fills the layer with the flat map's mean; the cook does the same). UASTC holds a constant alpha exactly on its own,
// but brushedPv's 248 beside the brushed concrete's normals comes out ~249.9 on average (+1.87 codes: roughness 0.973 ->
// 0.980) at every setting tried - level 2 / 3 / 4, RDO off / 1 / 2: 1.59-1.90. Its other channels are within 0.1 code.
const MEAN0_ALLOW = { 'brushedPv.kN': 2.0 };
const MEANM = 2.5;   // codes: a mip's per-channel mean vs the GPU's own box mip of the raw plane

const PLANES = { kA: { plane: 0, role: 'ktx2-color', opts: { alpha: true, mip: 'srgb', codec: 'uastc' }, srgbMip: true, stem: 'kA' },
  kAl: { plane: 0, role: 'ktx2-color', opts: { alpha: true, mip: 'linear', codec: 'uastc' }, srgbMip: false, stem: 'kAl' },
  kN: { plane: 1, role: 'ktx2-normal', opts: {}, srgbMip: false, stem: 'kN' } };

let fails = 0;
const out = [];
const verdict = (ok, line, detail) => { if (!ok) fails++; out.push((ok ? 'PASS ' : 'FAIL ') + line + (detail ? '  (' + detail + ')' : '')); return ok; };

function loadTable() {
  const c = { console };
  vm.runInNewContext(fs.readFileSync(abs('src/viewer/ground_tex.js'), 'utf8') + '\nthis.T = GROUND_TEX;', c);
  return JSON.parse(JSON.stringify(c.T));
}
// the views as the page makes them (an Image stub: the getters are never read here)
function loadViews(T) {
  const src = fs.readFileSync(abs('src/viewer/ground_tex.js'), 'utf8').replace(/const GROUND_TEX = \{[\s\S]*?\n\};\n/, 'const GROUND_TEX = ' + JSON.stringify(T) + ';\n');
  const c = { console, Image: function () {} };
  vm.runInNewContext(src + '\nthis.V = { splat: SPLAT_TEX_SETS, pavement: PAVEMENT_TEX_SETS };', c);
  return c.V;
}

// ---- 1 ------------------------------------------------------------------------------------------------------------
function checkVendor() {
  const V = abs('vendor/ktx2'), NM = path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
  const bad = [];
  for (const f of ['ktx2_loader.js', 'basis_transcoder.js', 'basis_transcoder.wasm']) if (!fs.existsSync(path.join(V, f))) bad.push(f + ' missing');
  let same = 'node_modules/three absent: not compared';
  if (!bad.length && fs.existsSync(NM)) {
    const pk = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'three', 'package.json'), 'utf8'));
    for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) if (!fs.readFileSync(path.join(V, f)).equals(fs.readFileSync(path.join(NM, f)))) bad.push(f + ' is not three@' + pk.version + '\'s');
    same = 'the transcoder is three@' + pk.version + '\'s byte for byte';
  }
  if (!bad.length) {
    const c = { console, URL, TextDecoder };
    vm.createContext(c);
    try { vm.runInContext(fs.readFileSync(abs('vendor/three.min.js'), 'utf8'), c); vm.runInContext(fs.readFileSync(path.join(V, 'ktx2_loader.js'), 'utf8'), c); if (typeof c.THREE.KTX2Loader !== 'function') bad.push('no THREE.KTX2Loader'); }
    catch (e) { bad.push('ktx2_loader.js: ' + e.message); }
  }
  return verdict(!bad.length, '1 the vendor: ktx2_loader.js adds THREE.KTX2Loader; ' + same, bad.join('; '));
}

// ---- 2 ------------------------------------------------------------------------------------------------------------
function checkTable(T, V) {
  const bad = [];
  const pav = new Set(T.libs.pavement.map(a => a.set)), spl = new Set(T.libs.splat.map(a => a.set));
  let files = 0;
  for (const [k, s] of Object.entries(T.sets)) {
    if (!s.layers) { for (const f of Object.keys(PLANES)) if (s[f]) bad.push(k + ' has ' + f + ' but no cooked layers'); continue; }
    const want = { kN: true, kA: pav.has(k), kAl: spl.has(k) };
    for (const f of Object.keys(PLANES)) {
      if (!!s[f] !== want[f]) bad.push(k + (want[f] ? ' lacks ' : ' has an unread ') + f);
      if (s[f]) { files++; if (!fs.existsSync(abs(s[f]))) bad.push(s[f] + ' not on disk'); }
    }
  }
  if (V) {
    for (const a of T.libs.pavement) { const v = V.pavement[a.key], s = T.sets[a.set]; if (s.layers && !(v && v.ktx && v.ktx.A === s.kA && v.ktx.N === s.kN)) bad.push('pavement view ' + a.key + ' does not hand kA + kN'); }
    for (const v of V.splat) { const s = T.sets[v.set]; if (s.layers && !(v.ktx && v.ktx.A === s.kAl && v.ktx.N === s.kN)) bad.push('splat view ' + v.key + ' does not hand kAl + kN'); }
  }
  verdict(!bad.length, '2 the table: ' + files + ' KTX2 planes, every cooked set its kN, the pavement\'s its kA, the splat\'s its kAl; the views hand each its own', bad.slice(0, 6).join('; '));
}

// the raw planes of a set (the cooked file: the KTX2's input)
const rawCache = new Map();
function rawPlanes(T, k) {
  if (rawCache.has(k)) return rawCache.get(k);
  const px = T.px, S = px * px * 4, raw = zlib.gunzipSync(fs.readFileSync(abs(T.sets[k].layers)));
  const r = [raw.subarray(0, S), raw.subarray(S, 2 * S)];
  rawCache.set(k, r); return r;
}

// ---- 3-6 ------------------------------------------------------------------------------------------------------------
async function checkFiles(T, over) {
  const px = T.px, LEVELS = Math.log2(px) + 1;
  const names = [], dec = [], tex = [], mips = [], stats = { 'ktx2-color': { rgb: [], a: [] }, 'ktx2-normal': { rgb: [], a: [] } };
  let wire = 0, gpu = 0, n = 0;
  for (const [k, s] of Object.entries(T.sets)) for (const [f, P] of Object.entries(PLANES)) {
    if (!s[f] || !s.layers || !fs.existsSync(abs(s[f]))) continue;
    n++;
    const plane = rawPlanes(T, k)[P.plane];
    const stem = `${k}_${P.stem}_${px}`;
    if (s[f].split('/').pop() !== K.ktx2Name(stem, plane, px, px, P.role, P.opts)) names.push(k + '.' + f);
    let bytes = fs.readFileSync(abs(s[f]));
    if (over && over.bytes) bytes = over.bytes(k, f, bytes) || bytes;
    wire += bytes.length; gpu += K.gpuBytesOf(bytes);
    let d;
    try { d = await K.decode(bytes); } catch (e) { dec.push(k + '.' + f + ': ' + e.message); continue; }
    const hdr = [];
    if (d.width !== px || d.height !== px) hdr.push(d.width + 'x' + d.height);
    if (d.levels !== LEVELS) hdr.push(d.levels + ' levels');
    if (d.layers !== 1 || d.faces !== 1) hdr.push(d.layers + ' layers');
    if ((P.role === 'ktx2-color' && P.opts.codec !== 'uastc') ? !d.etc1s : !d.uastc) hdr.push(d.etc1s ? 'ETC1S' : d.uastc ? 'UASTC' : 'another codec');
    if (!d.hasAlpha) hdr.push('no alpha');
    if (d.srgb !== null && d.srgb !== (P.role === 'ktx2-color')) hdr.push('transfer ' + (d.srgb ? 'sRGB' : 'linear'));
    if (hdr.length) dec.push(k + '.' + f + ': ' + hdr.join(', '));
    // 5: level 0
    const L0 = d.mips[0].data, F = FLOOR[P.role];
    const prgb = K.psnr(L0, plane, [0, 1, 2]), pa = K.psnr(L0, plane, [3]), m0 = K.meanDrift(L0, plane, [0, 1, 2, 3]);
    stats[P.role].rgb.push([prgb, k]); stats[P.role].a.push([pa, k]);
    if (prgb < F.rgb || pa < F.a || m0 > (MEAN0_ALLOW[k + '.' + f] || MEAN0)) tex.push(`${k}.${f} rgb ${prgb.toFixed(1)} a ${pa.toFixed(1)} dB, mean ${m0.toFixed(2)}`);
    // 6: the mips against the GPU's own
    let ref = { w: px, h: px, data: plane }, worst = 0, at = 0;
    for (let l = 1; l < d.levels; l++) {
      ref = K.boxMip(ref.data, ref.w, ref.h, P.srgbMip);
      const md = K.meanDrift(d.mips[l].data, ref.data, [0, 1, 2, 3]);
      if (md > worst) { worst = md; at = l; }
    }
    if (worst > MEANM) mips.push(`${k}.${f} level ${at}: ${worst.toFixed(2)} codes`);
    stats.mipWorst = Math.max(stats.mipWorst || 0, worst);
  }
  const MB = x => (x / 1048576).toFixed(1);
  verdict(!names.length && n > 0, `3 the names: ${n} files, each named by its raw plane + role + basisu ${K.BASISU_VERSION}`, names.slice(0, 6).join(', '));
  verdict(!dec.length, `4 every file decodes (every level, three@0.186's transcoder in node): ${n} files, ${MB(wire)} MiB on the wire, ${MB(gpu)} MiB on the GPU as BC7`, dec.slice(0, 6).join('; '));
  const lo = (a) => a.slice().sort((x, y) => x[0] - y[0])[0] || [0, '-'];
  const med = (a) => { const b = a.map(x => x[0]).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const line = r => `${r}: rgb median ${med(stats[r].rgb).toFixed(1)} / worst ${lo(stats[r].rgb)[0].toFixed(1)} [${lo(stats[r].rgb)[1]}], alpha ${med(stats[r].a).toFixed(1)} / ${lo(stats[r].a)[0].toFixed(1)} [${lo(stats[r].a)[1]}] dB (floor ${FLOOR[r].rgb} / ${FLOOR[r].a})`;
  verdict(!tex.length, `5 the texels, level 0 vs the raw plane: ${line('ktx2-color')}; ${line('ktx2-normal')}; every mean within ${MEAN0} codes`, tex.slice(0, 6).join('; '));
  verdict(!mips.length, `6 the mips vs the GPU's own generateMipmap of the raw plane (linear light for kA, stored values for kAl / kN): worst mean ${(stats.mipWorst || 0).toFixed(2)} codes (limit ${MEANM})`, mips.slice(0, 6).join('; '));
  if (STATS) for (const r of Object.keys(FLOOR)) console.log('  ' + r + ' lowest: ' + stats[r].rgb.slice().sort((x, y) => x[0] - y[0]).slice(0, 5).map(x => x[1] + ' ' + x[0].toFixed(1)).join(', '));
  return { n, wire, gpu };
}

// ---- 7 ------------------------------------------------------------------------------------------------------------
function checkPage(over) {
  const bad = [];
  let src = fs.readFileSync(abs('src/viewer/ktx2.js'), 'utf8');
  if (over && over.ktx2js) src = over.ktx2js(src);
  const R = { extensions: { has: e => e === 'EXT_texture_compression_bptc' } };
  const off = (search, extra) => {
    const store = Object.assign({}, (extra && extra.store) || {});
    const c = Object.assign({ console, location: { search }, localStorage: { getItem: k => (k in store ? store[k] : null) }, Worker: function () {}, WebAssembly }, extra || {});
    c.window = c; c.window.FLYDIY_RENDERER = extra && 'R' in extra ? extra.R : R;
    vm.runInNewContext(src + '\nthis.W = KTX2.off();', c);
    return c.W;
  };
  if (off('') !== null) bad.push('on by default gives ' + off(''));
  if (off('?ktx2=0') !== 'ktx2=0') bad.push('?ktx2=0 ignored');
  if (off('?a=1&ktx2=0&b') === null) bad.push('?..&ktx2=0 ignored');
  if (off('', { store: { 'flydiy.ktx2': '0' } }) === null) bad.push('flydiy.ktx2 = 0 ignored');
  if (off('', { Worker: undefined }) === null) bad.push('no Worker taken as on');
  if (off('', { R: { extensions: { has: () => false } } }) === null) bad.push('a GPU with no compressed format taken as on');
  const offF = (search, fam) => { const c = { console, location: { search }, localStorage: { getItem: () => null }, Worker: function () {}, WebAssembly }; c.window = c; c.FLYDIY_RENDERER = R;
    vm.runInNewContext(src + '\nthis.W = KTX2.off(' + JSON.stringify(fam) + ');', c); return c.W; };
  if (offF('?ktx2=pier,props', 'ground') === null || offF('?ktx2=pier,props', 'pier') !== null || offF('?ktx2=ground', 'ground') !== null) bad.push('?ktx2=<families> does not pick the families');
  return { bad, src };
}
// GROUND_LIB's two paths, run (a stub fetch and a stub transcoder; the real three): the KTX2 pack stacks each layer's
// levels into ONE CompressedArrayTexture (the file's mips, generateMipmaps off, the caller's colour space); a grow lends
// the layers it holds; ANY failure (here: one transcode) drops the whole pack to the raw layers
async function checkGroundLib(over) {
  const bad = [];
  let gl = fs.readFileSync(abs('src/viewer/ground_lib.js'), 'utf8');
  if (over && over.groundlib) gl = over.groundlib(gl);
  const THREE = require('../vendor/three.min.js');
  const px = 8, S = px * px * 4, LV = 4;
  const fetched = [];
  const ASSET_FETCH = u => { fetched.push(u); return Promise.resolve(/\.gz\.bin$/.test(u) ? new Uint8Array(2 * S).fill(u.length & 255) : new Uint8Array([u.length])); };
  const mkKTX = failOn => ({ off: () => null, _stats: { fallbacks: 0 },
    parse: b => (failOn && b[0] === failOn ? Promise.reject(new Error('transcode failed')) : Promise.resolve({ width: px, height: px, format: THREE.RGBA_BPTC_Format, type: THREE.UnsignedByteType,
      mipmaps: Array.from({ length: LV }, (_, l) => ({ data: new Uint8Array(Math.max(1, (px >> l) / 4) ** 2 * 16).fill(b[0] + l), width: px >> l, height: px >> l })) })) });
  const load = K => new Function('ASSET_FETCH', 'GROUND_TEX', 'KTX2', 'console', gl + '\nreturn GROUND_LIB;')(ASSET_FETCH, { px }, K, { warn() {}, log() {} });
  const items = ['a', 'bb', 'ccc'].map(k => ({ layers: k + '.gz.bin', ktx: { A: k + 'A.ktx2', N: k + 'N.ktx2' }, mean: [0.1, 0.1, 0.1], label: k }));
  const pack = (L, its, prev) => new Promise(res => L.pack(its, (A, N, f) => res({ A, N, f }), prev));
  try {
    const L = load(mkKTX(null));
    const r = await pack(L, items);
    if (!r.A || !r.A.ktx2 || r.A.layers.length !== 3 || r.A.levels !== LV) bad.push('the KTX2 pack did not deliver 3 compressed layers of ' + LV + ' levels');
    else {
      const t = L.arrayTexture(THREE, r.A, 3, { srgb: true, aniso: 16 });
      const m0 = t.mipmaps && t.mipmaps[0];
      if (!t.isCompressedArrayTexture || t.generateMipmaps !== false || t.colorSpace !== THREE.SRGBColorSpace || !m0 || m0.data.length !== 3 * (px / 4) ** 2 * 16 || m0.data[0] !== 'aA.ktx2'.length || m0.data[m0.data.length - 1] !== 'cccA.ktx2'.length || t.mipmaps.length !== LV)
        bad.push('arrayTexture: not one CompressedArrayTexture of the layers\' levels in order, sRGB, generateMipmaps off');
      const n0 = fetched.length;
      const grown = await pack(L, items.concat([{ layers: 'dddd.gz.bin', ktx: { A: 'ddddA.ktx2', N: 'ddddN.ktx2' }, mean: [0.1, 0.1, 0.1], label: 'dddd' }]), { urls: items.map(i => i.layers), A: L.planeOf(t), N: r.N });
      if (!grown.A || !grown.A.ktx2 || fetched.length - n0 !== 2 || grown.A.layers[0] !== r.A.layers[0]) bad.push('a grow did not lend the layers it held (fetched ' + (fetched.length - n0) + ', want 2)');
    }
    const L2 = load(mkKTX('bbA.ktx2'.length));
    const r2 = await pack(L2, items);
    if (!(r2.A instanceof Uint8Array) || r2.A.length !== 3 * S || L2.stats().ktx2Fallbacks !== 1) bad.push('one failed transcode did not drop the whole pack to the raw layers');
    const t2 = L2.arrayTexture(THREE, r2.A, 3, {});
    if (!t2.isDataArrayTexture || t2.generateMipmaps !== true) bad.push('the raw fallback is not the old DataArrayTexture (GPU mips)');
    const L3 = load({ off: () => 'ktx2=0', _stats: {} });
    const r3 = await pack(L3, items);
    if (!(r3.A instanceof Uint8Array) || L3.stats().ktx2Packs !== 0) bad.push('KTX2 off: the pack did not take the raw layers');
  } catch (e) { bad.push('ground_lib.js threw: ' + e.message); }
  return bad;
}
async function checkPageAll(over) {
  const { bad } = checkPage(over);
  bad.push(...await checkGroundLib(over));
  return bad;
}
function checkPageTail(bad) {
  const { MANIFEST } = require('./build.js');
  if (!MANIFEST.lazy.some(([d, f]) => d === 'vendor/ktx2' && f === 'ktx2_loader.js')) bad.push('the loader is not in build.js MANIFEST.lazy');
  const scripts = (MANIFEST.viewer && MANIFEST.viewer.scripts) || [];
  if (scripts.indexOf('ktx2.js') < 0 || scripts.indexOf('ktx2.js') > scripts.indexOf('ground_lib.js')) bad.push('ktx2.js is not before ground_lib.js');
  return verdict(!bad.length, '7 the page: on by default where it can be; ?ktx2=<families> picks them; ?ktx2=0 / flydiy.ktx2 = 0 / no Worker / no compressed format -> off; GROUND_LIB stacks the layers into one compressed array, lends them on a grow, and takes the raw layers on any failure; the loader lazy', bad.join('; '));
}

// ---- 9: the twins of the plain maps (tools/ktx2_twins.js, src/viewer/ktx2_twins.js) ---------------------------------
// every (map, slot kind) the pier's and the props' material records read has its twin; each twin is named by its map's
// decoded texels + role, decodes to the map's size with a full mip chain, meets the same bar (level 0, the mean, the
// mips vs the GPU's own), and the table's mean colour is the map's. Needs python + Pillow (the decode): skipped, said,
// when absent.
async function checkTwins(over) {
  const file = abs('src/viewer/ktx2_twins.js');
  if (!fs.existsSync(file)) { out.push('SKIP 9 the twins: no src/viewer/ktx2_twins.js'); return null; }
  const c = {}; vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nthis.T = KTX2_TWINS_TABLE;', c);
  const T = JSON.parse(JSON.stringify(c.T));
  if (over && over.twins) over.twins(T);
  const TW = require('./ktx2_twins.js');
  const bad = [], miss = [];
  const fams = [...new Set(Object.values(T).map(r => r.fam))];
  // coverage per (family, kind) the table carries at all (tools/ktx2_twins.js --kinds may leave a kind to its images)
  const has = new Set(Object.entries(T).map(([k, r]) => r.fam + '|' + k.split('|')[1]));
  for (const fam of Object.keys(TW.FAMILIES)) for (const w of TW.wanted(fam)) if (has.has(fam + '|' + w.kind) && !T[w.rel + '|' + w.kind]) miss.push(w.rel + ' (' + w.kind + ')');
  const rows = Object.entries(T);
  let dec;
  try { dec = require('./_media_lib.js').decodeRGBA(rows.map(([k]) => abs(k.split('|')[0]))); }
  catch (e) { out.push('SKIP 9 the twins: the maps need python + Pillow to decode (' + String(e.message).slice(0, 80) + ') - ' + rows.length + ' twins not held'); return null; }
  let wire = 0, src = 0, gpu = 0, rgba = 0, worst = [99, ''], etc = 0, ua = 0;
  for (let i = 0; i < rows.length; i++) {
    const [k, r] = rows[i], rel = k.split('|')[0], kind = k.split('|')[1], im = dec[i];
    if (!fs.existsSync(abs(r.twin))) { bad.push(r.twin + ' not on disk'); continue; }
    // the name's hash is the map's texels + role (a twin two maps of the same texels share keeps the first one's stem)
    if (!path.basename(r.twin).endsWith('.' + K.ktx2Hash(im.data, im.w, im.h, r.role, r.opts) + '.ktx2')) { bad.push(k + ': the name is not its map\'s texels + role'); continue; }
    let bytes = fs.readFileSync(abs(r.twin));
    if (over && over.twinBytes) bytes = over.twinBytes(k, bytes) || bytes;
    let m;
    try { m = await TW.meets(bytes, im.data, im.w, im.h, kind === 'color'); } catch (e) { bad.push(k + ': ' + e.message); continue; }
    const d = await K.decode(bytes, { levels: 1 });
    if (d.width !== im.w || d.height !== im.h || d.levels !== Math.floor(Math.log2(Math.max(im.w, im.h))) + 1) bad.push(k + ': ' + d.width + 'x' + d.height + ', ' + d.levels + ' levels');
    if (!m.ok) bad.push(`${k}: rgb ${m.rgb.toFixed(1)} a ${m.a.toFixed(1)} dB, mean ${m.mean0.toFixed(2)}, mips ${m.meanM.toFixed(2)}`);
    let mr = 0, mg = 0, mb = 0; for (let q = 0; q < im.data.length; q += 4) { mr += im.data[q]; mg += im.data[q + 1]; mb += im.data[q + 2]; }
    const np = im.w * im.h; if (!r.mean || [mr, mg, mb].some((v, j) => Math.abs(v / np - r.mean[j]) > 0.1)) bad.push(k + ': the table\'s mean is not the map\'s');
    if (m.rgb < worst[0]) worst = [m.rgb, rel.split('/').pop()];
    if (m.codec === 'UASTC') ua++; else etc++;
    wire += bytes.length; src += fs.statSync(abs(rel)).size; gpu += K.gpuBytesOf(bytes); rgba += Math.round(im.w * im.h * 4 * 4 / 3);
  }
  const MB = x => (x / 1048576).toFixed(1);
  verdict(!bad.length && !miss.length, `9 the twins (${fams.join(', ')}): ${rows.length} (${etc} ETC1S, ${ua} UASTC), every map the records read has one, each named by its map's texels + role, each within the bar (worst level 0 ${worst[0].toFixed(1)} dB [${worst[1]}]); ${MB(wire)} MiB of twins for ${MB(src)} MiB of maps; GPU ${MB(rgba)} -> ${MB(gpu)} MiB (BC7)`,
    (miss.length ? miss.length + ' maps without a twin (run tools/ktx2_twins.js): ' + miss.slice(0, 3).join(', ') + '; ' : '') + bad.slice(0, 5).join('; '));
  return { rows: rows.length };
}

// ---- 10: the characters' texture budget (AS6, G937; tools/char_tex_budget.js, src/chars/chars_ktx2.js) -------------
// (a) THE TABLE: every character the manifests declare has its row, one per material, cut from the maps that manifest
// names today (src), and the plan re-derived from those maps (tools/char_tex_budget.js plan(): which planes, which
// constants, which normal carries which gloss) is the table's; (b) THE FILES: each file's name is its plane's texels +
// role (the plane re-cut here from the 2048 maps: the 2x2 box to TEX_BUDGET.size, the gloss's G into N.a), it decodes
// to the plane's size with a full chain, UASTC, the DFD's transfer sRGB for the diffuse and linear for the normal, and
// meets the bar (level 0 25 dB rgb and alpha - the alpha being the gloss on a normal -, the mean, every mip to 16 px,
// the diffuse's 32 px tiles); the flat specular is flat. (a)-(b) need python + Pillow: SKIP said when absent.
// (c) THE PAGE (always): tools/_cage_char.js run on stubs - the budget set taken by default (the textures upgraded in
// place to the KTX2 files), ?ktx2=0 = the 2048 maps through the old texture() (every map, no KTX2 load), a stale row
// = the old path, a failed transcode = the 2048 map into the same texture, a flat normal = no normal map, and the gloss
// read only with ?chargloss=1.
function loadCharTable(over) {
  const c = { FLYDIY_ASSET_BASE: '' };
  vm.runInNewContext(fs.readFileSync(abs('src/chars/chars_ktx2.js'), 'utf8') + '\nthis.T = CHAR_KTX2_TABLE;', c);
  const T = JSON.parse(JSON.stringify(c.T));
  if (over && over.chars) over.chars(T);
  return T;
}
async function checkCharFiles(T, over) {
  const CB = require('./char_tex_budget.js');
  const TB = CB.budget(), chars = CB.manifests();
  // G939.1 (train 17): since AS0b (G903) a texs entry may be a flat map's CONSTANT [r, g, b] - no file to decode
  const rels = [...new Set(chars.flatMap(c => Object.values(c.texs).filter(v => typeof v === 'string')))].sort();
  let D;
  try { D = require('./_media_lib.js').decodeRGBA(rels.map(abs)); }
  catch (e) { out.push('SKIP 10a-b the characters\' files: the maps need python + Pillow to decode (' + String(e.message).slice(0, 80) + ')'); return; }
  const byRel = new Map(rels.map((r, i) => [r, D[i]]));
  const dec = rel => byRel.get(rel);
  const bad = [], seen = new Map();
  let worst = [99, ''], worstA = [99, ''], worstTile = [0, ''], files = 0, gOld = 0, gNew = 0, nMats = 0;
  for (const c of chars) {
    const row = T[c.key];
    if (!row) { bad.push(c.key + ': no row (node tools/char_tex_budget.js)'); continue; }
    if (row.mats.length !== c.mats.length) { bad.push(c.key + ': ' + row.mats.length + ' rows for ' + c.mats.length + ' materials'); continue; }
    const P = CB.plan(c, TB, dec);
    gOld += CB.gpuOld(c, dec).bound;
    const urls = new Set();
    for (let mi = 0; mi < c.mats.length; mi++) {
      const m = c.mats[mi], r = row.mats[mi], p = P.mats[mi], tag = c.key + '/' + (m.name || mi);
      nMats++;
      for (const k of ['map', 'nrm', 'mr', 'spec']) if (JSON.stringify(m[k] ? c.texs[m[k]] : undefined) !== JSON.stringify(r.src[k])) bad.push(tag + ': stale (' + k + ' ' + r.src[k] + ' is not the manifest\'s ' + (m[k] ? c.texs[m[k]] : 'none') + ')');
      if (!!r.gloss !== !!p.gloss) bad.push(tag + ': gloss ' + !!r.gloss + ', the plan ' + !!p.gloss);
      if (JSON.stringify(r.nrmConst || null) !== JSON.stringify(p.nrmConst || null) || !!r.nrm === !!p.nrmConst) bad.push(tag + ': the normal is ' + (r.nrm ? 'a file' : 'a constant') + ', the plan ' + (p.nrmConst ? 'a constant' : 'a file'));
      if (p.spec && (JSON.stringify(r.spec) !== JSON.stringify(p.spec) || !(p.specStd < TB.flat))) bad.push(tag + ': the specular constant ' + JSON.stringify(r.spec) + ' is not the flat map\'s ' + JSON.stringify(p.spec) + ' (std ' + p.specStd + ')');
      for (const [slot, kind] of [['map', 'color'], ['nrm', 'normal']]) {
        if (!p[slot]) { if (r[slot]) bad.push(tag + ': a ' + slot + ' file the plan has no plane for'); continue; }
        const url = r[slot], f = url && row.files[url];
        if (!f) { bad.push(tag + ': no ' + slot + ' file'); continue; }
        urls.add(url);
        if (!fs.existsSync(abs(url))) { bad.push(url + ' not on disk'); continue; }
        const pl = P.planes.get(p[slot]);
        if (seen.has(url + '|' + p[slot])) continue;
        if (!seen.has(url)) files++;
        seen.set(url + '|' + p[slot], 1); seen.set(url, 1);
        const im = pl.build();
        if (!path.basename(url).endsWith('.' + K.ktx2Hash(im.data, im.w, im.h, f.role, f.opts) + '.ktx2')) { bad.push(tag + ': ' + slot + ' ' + path.basename(url) + ' is not its plane\'s texels + role'); continue; }
        let bytes = fs.readFileSync(abs(url));
        if (over && over.charBytes) bytes = over.charBytes(url, bytes) || bytes;
        let q;
        try { q = await CB.measure(bytes, im, kind === 'color'); } catch (e) { bad.push(url + ': ' + e.message); continue; }
        const full = Math.floor(Math.log2(Math.max(im.w, im.h))) + 1;
        if (q.w !== im.w || q.h !== im.h || q.levels !== full || q.codec !== 'UASTC' || q.srgb !== (kind === 'color')) bad.push(`${url}: ${q.w}x${q.h}, ${q.levels} levels, ${q.codec}, sRGB ${q.srgb}`);
        if (!q.ok) bad.push(`${url}: rgb ${q.rgb} a ${q.a} dB, mean ${q.mean0}, mips ${q.meanM}, tile ${q.tile}`);
        if (Math.max(im.w, im.h) > TB.size) bad.push(url + ': ' + im.w + 'x' + im.h + ' over the budget\'s ' + TB.size);
        if (q.rgb < worst[0]) worst = [q.rgb, path.basename(url)];
        if (kind === 'normal' && p.gloss && q.a < worstA[0]) worstA = [q.a, path.basename(url)];
        if (kind === 'color' && q.tile > worstTile[0]) worstTile = [q.tile, path.basename(url)];
      }
    }
    for (const u of urls) gNew += K.gpuBytesOf(fs.readFileSync(abs(u)));
  }
  const on = new Set(Object.values(T).flatMap(r => Object.keys(r.files)));
  const disk = fs.existsSync(abs('media/tex/ktx2/chars')) ? fs.readdirSync(abs('media/tex/ktx2/chars')).map(f => 'media/tex/ktx2/chars/' + f) : [];
  for (const f of disk) if (!on.has(f)) bad.push(f + ': on disk, in no row (an orphan)');
  const MB = x => (x / 1048576).toFixed(1);
  verdict(!bad.length, `10 the characters' budget: ${chars.length} characters, ${nMats} materials, ${files} files (every plane re-cut from its 2048 maps: ${TB.size}^2, gloss in N.a, the flat specular a constant) = their names, UASTC, within the bar (worst rgb ${worst[0]} dB [${worst[1]}], worst gloss ${worstA[0]} dB [${worstA[1]}], worst skin tile ${worstTile[0]} codes [${worstTile[1]}]); GPU ${MB(gOld)} -> ${MB(gNew)} MiB for the six`, bad.slice(0, 5).join('; '));
}
async function checkCharPage(T, over) {
  const THREE = require('../vendor/three.min.js');
  let src = fs.readFileSync(abs('tools/_cage_char.js'), 'utf8');
  if (over && over.cagechar) src = over.cagechar(src);
  const codec = fs.readFileSync(abs('src/core/52_char_codec.js'), 'utf8').replace(/\nif \(typeof module[\s\S]*$/, '\n');
  const tableOf = TT => fs.readFileSync(abs('src/chars/chars_ktx2.js'), 'utf8').replace(/const CHAR_KTX2_TABLE = \{[\s\S]*?\n\};\n/, () => 'const CHAR_KTX2_TABLE = ' + JSON.stringify(TT) + ';\n');
  const idx = JSON.parse(fs.readFileSync(abs('src/chars/chars_index.json'), 'utf8')).filter(f => /_char\.js$/.test(f));
  const tick = () => new Promise(r => setImmediate(r));
  const page = async (search, opts) => {
    opts = opts || {};
    const loads = [];
    class Image { set src(v) { this._src = v; } get src() { return this._src; } }
    const KTX2 = { off: fam => (/ktx2=0/.test(search) ? 'ktx2=0' : null), _stats: { fallbacks: 0 },
      load: (url, fam) => { loads.push([url, fam]); return opts.fail ? Promise.reject(new Error('transcode failed')) : Promise.resolve({ width: 1024, height: 1024, format: THREE.RGBA_BPTC_Format, type: THREE.UnsignedByteType, mipmaps: [{ data: new Uint8Array(16), width: 4, height: 4 }] }); } };
    const ctx = { console: { log() {}, warn() {} }, THREE, Image, KTX2, ASSET_FETCH: () => Promise.reject(new Error('no bin here')), location: { search }, localStorage: { getItem: () => null },
      BOOT: { img() {}, expect() {}, landed() {} }, FLYDIY_ASSET_BASE: '', Promise, setTimeout, clearTimeout, Math, JSON, Object, Array, Set, Map,
      // G939.1: AS0b's flat maps are constants the page stands as src/viewer/assets.js TEX_FLAT's shared 1x1 - a stub here
      TEX_FLAT: (rgb, cs) => { const t = new THREE.Texture(null); t.userData = { flat: rgb.slice(0, 3) }; t.colorSpace = cs || ''; return t; } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(codec, ctx);
    for (const f of idx) vm.runInContext(fs.readFileSync(abs('src/chars/' + f), 'utf8'), ctx);
    vm.runInContext(tableOf(opts.T || T), ctx);
    vm.runInContext(src, ctx);
    const REG = vm.runInContext('CHAR_REG', ctx), mats = [];
    for (const key of REG.order) REG.chars[key].mats.forEach((m, mi) => mats.push({ key, mi, m, c: REG.chars[key], mat: ctx.CAGE_CHAR.flatMaterial(key, mi) }));
    for (let i = 0; i < 4; i++) await tick();
    return { mats, loads, KTX2 };
  };
  const bad = [];
  try {
    // the budget set, by default
    const A = await page('');
    let n = 0;
    for (const { key, mi, m, c, mat } of A.mats) {
      const r = T[key].mats[mi];
      if (m.map && (!mat.map || mat.map.userData.ktx2 !== r.map || !mat.map.isCompressedTexture || mat.map.colorSpace !== THREE.SRGBColorSpace || mat.map.flipY !== false)) bad.push(key + '/' + mi + ': the diffuse is not the budget file, compressed, sRGB, flipY off');
      if (r.nrm && (!mat.normalMap || mat.normalMap.userData.ktx2 !== r.nrm || mat.normalMap.colorSpace === THREE.SRGBColorSpace)) bad.push(key + '/' + mi + ': the normal is not the budget file, linear');
      if (r.nrmConst && mat.normalMap) bad.push(key + '/' + mi + ': a flat normal still bound as a map');
      if (mat.roughness !== 0.62 || Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')) bad.push(key + '/' + mi + ': the look moved (roughness ' + mat.roughness + ', a shader hook) without ?chargloss=1');
      n++;
    }
    if (A.loads.some(([u, f]) => f !== 'chars') || !A.loads.length) bad.push('the budget files are not loaded as the chars family');
    // ?ktx2=0: the old path, every map the 2048 map through texture(), nothing loaded as KTX2
    const B = await page('?ktx2=0');
    if (B.loads.length) bad.push('?ktx2=0 still loads ' + B.loads.length + ' KTX2 files');
    for (const { key, mi, m, c, mat } of B.mats) {
      // (G939.1: a flat map's constant binds TEX_FLAT's 1x1 on the old path - its userData.flat, not a file)
      const isF = v => typeof v === 'string', flatOk = (t, v) => !!t && !!t.userData && JSON.stringify(t.userData.flat) === JSON.stringify(v.slice(0, 3));
      if (m.map && (isF(c.texs[m.map]) ? (!mat.map || !mat.map.image || mat.map.image.src !== c.texs[m.map] || mat.map.isCompressedTexture) : !flatOk(mat.map, c.texs[m.map]))) bad.push(key + '/' + mi + ': ?ktx2=0 does not bind the 2048 diffuse');
      if (m.nrm && (isF(c.texs[m.nrm]) ? (!mat.normalMap || !mat.normalMap.image || mat.normalMap.image.src !== c.texs[m.nrm]) : !flatOk(mat.normalMap, c.texs[m.nrm]))) bad.push(key + '/' + mi + ': ?ktx2=0 does not bind the 2048 normal');
    }
    // a stale row (a character re-baked from its GLB): the old path
    const T2 = JSON.parse(JSON.stringify(T)); const k0 = Object.keys(T2)[0]; T2[k0].mats[0].src.map += '.stale';
    const Cst = await page('', { T: T2 });
    const st = Cst.mats.find(x => x.key === k0 && x.mi === 0);
    if (!st || !st.mat.map || st.mat.map.image.src !== st.c.texs[st.m.map] || st.mat.map.userData.ktx2) bad.push('a stale row is taken (' + k0 + '/0)');
    // a failed transcode: the 2048 map into the same texture
    const F = await page('', { fail: true });
    const f0 = F.mats.find(x => x.m.map);
    if (!f0 || f0.mat.map.image.src !== f0.c.texs[f0.m.map] || f0.mat.map.isCompressedTexture || !F.KTX2._stats.fallbacks) bad.push('a failed transcode does not fall back to the 2048 map');
    // the gloss read: ?chargloss=1 only, 1 - N.a into roughness, the uniform on once the plane lands
    const G = await page('?chargloss=1');
    const g = G.mats.find(x => T[x.key].mats[x.mi].gloss);
    if (!g) bad.push('no material carries a gloss');
    else {
      const sh = { uniforms: {}, fragmentShader: '#include <roughnessmap_fragment>', vertexShader: '' };
      if (typeof g.mat.onBeforeCompile !== 'function') bad.push('?chargloss=1: no hook'); else g.mat.onBeforeCompile(sh, null);
      if (!/1\.0 - texture2D\(normalMap, vNormalMapUv\)\.a/.test(sh.fragmentShader) || !sh.uniforms.uGloss || sh.uniforms.uGloss.value !== 1) bad.push('?chargloss=1: roughness is not 1 - N.a with uGloss on (' + JSON.stringify(sh.uniforms.uGloss) + ')');
    }
    out.push('     10c the page: ' + n + ' materials on the budget set; ' + A.loads.length + ' KTX2 loads (chars); ?ktx2=0 ' + B.loads.length + ' loads, every map the 2048 one');
  } catch (e) { bad.push('_cage_char.js on stubs threw: ' + (e && e.stack || e).toString().slice(0, 300)); }
  verdict(!bad.length, '10 the characters\' page: the budget set by default, upgraded in place; ?ktx2=0 = the 2048 maps (the old texture(), no KTX2); a stale row or a failed transcode = the 2048 map; a flat normal = no map; the gloss read only with ?chargloss=1', bad.slice(0, 4).join('; '));
}
async function checkChars(over) {
  if (!fs.existsSync(abs('src/chars/chars_ktx2.js'))) { verdict(false, '10 the characters: no src/chars/chars_ktx2.js (node tools/char_tex_budget.js)'); return; }
  const T = loadCharTable(over);
  await checkCharFiles(T, over);
  await checkCharPage(T, over);
}

// ---- 8 ------------------------------------------------------------------------------------------------------------
function checkEncoder(T) {
  if (!K.hasEncoder()) { out.push('SKIP 8 the encoder: no basisu v' + K.BASISU_VERSION + ' here (cd flyDiy && npm install) - the files are held by 3-6'); return; }
  // G939.1 (train 17): the Windows build of basisu v1.16.4 does not write the Linux build's bytes (the shipped files were
  // encoded on Linux: 3 of 3 differ here, every level within the bar) - the names hash the INPUTS, so this byte check
  // only speaks on the platform that encoded them; the texels are held by 3-6 either way
  if (process.platform === 'win32' && !process.env.KTX2_ENCODER_CHECK) { out.push('SKIP 8 the encoder: the Windows basisu build writes other bytes than the Linux one the files were encoded with (KTX2_ENCODER_CHECK=1 to run it) - the files are held by 3-6'); return; }
  const all = [];
  for (const [k, s] of Object.entries(T.sets)) for (const [f, P] of Object.entries(PLANES)) if (s[f] && s.layers) all.push([k, f, P]);
  const pick = FULL ? all : [all[0], all.find(x => x[1] === 'kAl'), all.find(x => x[1] === 'kN')].filter(Boolean);
  const bad = [];
  for (const [k, f, P] of pick) {
    const b = K.encodeRGBA(rawPlanes(T, k)[P.plane], T.px, T.px, P.role, P.opts);
    if (!b.equals(fs.readFileSync(abs(T.sets[k][f])))) bad.push(k + '.' + f);
  }
  verdict(!bad.length, `8 the encoder: ${pick.length} of ${all.length} files re-encoded from their raw planes = the shipped bytes${FULL ? '' : ' (--full: all)'}`, bad.join(', ') + (bad.length ? ' - another basisu build? the names are the inputs\', so a mismatch here is the encoder, not the texels' : ''));
}

async function run(T, over) {
  const V = loadViews(T);
  checkTable(T, V);
  const r = await checkFiles(T, over);
  checkPageTail(await checkPageAll(over));
  if (!over || over.twins || over.twinBytes) await checkTwins(over);
  if (!over || over.chars || over.charBytes || over.cagechar) await checkChars(over);
  return r;
}

async function main() {
  const t0 = Date.now();
  const T = loadTable();
  if (SELF) {
    const cases = [
      ['a byte flipped in a colour file', T2 => ({ over: { bytes: (k, f, b) => { if (f !== 'kA' || k !== Object.keys(T2.sets).find(x => T2.sets[x].kA)) return null; const c = Buffer.from(b); c[c.length >> 1] ^= 0x5a; return c; } } }), /^FAIL [45] /],
      ['two sets\' colour swapped', T2 => { const ks = Object.keys(T2.sets).filter(k => T2.sets[k].kA); const a = T2.sets[ks[0]].kA; T2.sets[ks[0]].kA = T2.sets[ks[1]].kA; T2.sets[ks[1]].kA = a; return {}; }, /^FAIL [35] /],
      ['the splat pointed at the sRGB-mip variant', T2 => { const k = Object.keys(T2.sets).find(x => T2.sets[x].kAl); const K2 = Object.keys(T2.sets).find(x => T2.sets[x].kA && x !== k); T2.sets[k].kAl = T2.sets[K2].kA; return {}; }, /^FAIL [356] /],
      ['a normal plane encoded as ETC1S', T2 => { const k = Object.keys(T2.sets).find(x => T2.sets[x].kN); const b = K.encodeRGBA(rawPlanes(T2, k)[1], T2.px, T2.px, 'ktx2-color', { alpha: true }); return { over: { bytes: (kk, f) => (kk === k && f === 'kN' ? b : null) } }; }, /^FAIL [45] /, true],
      ['a kN dropped', T2 => { const k = Object.keys(T2.sets).find(x => T2.sets[x].kN); delete T2.sets[k].kN; return {}; }, /^FAIL 2 /],
      ['?ktx2=0 ignored', () => ({ over: { ktx2js: s => s.replace("if (/[?&]ktx2=0(?:&|$)/.test(q)) return 'ktx2=0';", '') } }), /^FAIL 7 /],
      ['a twin swapped for another map\'s', () => ({ over: { twins: T => { const ks = Object.keys(T); const a = T[ks[0]].twin; T[ks[0]].twin = T[ks[1]].twin; T[ks[1]].twin = a; } } }), /^FAIL 9 /],
      ['a map without its twin', () => ({ over: { twins: T => { delete T[Object.keys(T)[3]]; } } }), /^FAIL 9 /],
      ['GROUND_LIB keeps a half-compressed pack', () => ({ over: { groundlib: s => s.replace('packKtx(items, prev, F).then(r => done(r.A, r.N, []), e => {', 'packKtx(items, prev, F).then(r => done(r.A, r.N, []), e => { done(null, null, []); return;') } }), /^FAIL 7 /],
    ];
    // AS6 (G937): the characters' budget
    cases.push(['a character\'s file swapped for another\'s', () => ({ over: { charBytes: (u, b) => { const T0 = loadCharTable(); const fs0 = Object.keys(T0[Object.keys(T0)[0]].files); return u === fs0[0] ? fs.readFileSync(abs(fs0[1])) : null; } } }), /^FAIL 10 /]);
    cases.push(['the characters\' ?ktx2=0 ignored', () => ({ over: { cagechar: s => s.replace("if (KTX2.off('chars')) return null;", '') } }), /^FAIL 10 /]);
    cases.push(['a stale character row taken', () => ({ over: { cagechar: s => s.replace("if ((m[k] ? c.texs[m[k]] : undefined) !== b.src[k]) return null;", '') } }), /^FAIL 10 /]);
    let bad = 0;
    for (const [name, mut, re, needsEnc] of cases) {
      if (needsEnc && !K.hasEncoder()) { console.log('  skip  ' + name + ' (no encoder)'); continue; }
      out.length = 0; fails = 0;
      const T2 = JSON.parse(JSON.stringify(T));
      const o = mut(T2) || {};
      await run(T2, o.over);
      const red = out.filter(l => re.test(l));
      console.log((red.length ? '  red   ' : '  MISSED ') + name + (red.length ? '  <- ' + red[0].slice(0, 110) : ''));
      if (!red.length) bad++;
    }
    console.log('GATE KTX2 --selftest: ' + (bad ? 'FAIL' : 'PASS') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
    process.exit(bad ? 1 : 0);
  }
  checkVendor();
  await run(T);
  checkEncoder(T);
  for (const l of out) console.log(l);
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log('GATE KTX2: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.error(e && e.stack || e); console.log('GATE KTX2: FAIL'); process.exit(1); });
