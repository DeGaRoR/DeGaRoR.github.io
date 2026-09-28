#!/usr/bin/env node
// asset_census.js - THE ASSET CENSUS (futureDesigns/ASSETS-2026-09-27.md, the asset-rationalization study).
//
// A MEASUREMENT, not a gate: it moves nothing, writes nothing under media/ or src/, and never
// re-encodes a file ([[import-models-as-is]]: it reads headers and, with --decode, decodes to
// measure - it never writes an image or a mesh back).
//
// TWO MODES.
//
//   STATIC (node, any box, the cloud included):
//     node tools/asset_census.js                 the summary tables (textures, meshes, materials, load)
//       --json <file>                            everything, one row per file, for diffing later
//       --decode                                 + near-duplicates and decode ms: python + PIL (the
//                                                bakers' own dependency, tools/media_lib.py) decodes
//                                                every image once to a 16x16 grey thumbnail
//       --md                                     the tables as markdown (what ASSETS-2026-09-27.md quotes)
//       --top <n>                                rows per ranked list (default 15)
//     What it reads: media/ (every file), assets/, the manifests that name media (src/**.js|json,
//     tools/_*_gen.js, tools/_house_kit.js), tools/build.js's MANIFEST (what the shipped page
//     references), sw.js's WORLD_KEEP, src/core/world_packs.json (the boot's world fetch).
//
//   RUNTIME (the LOCAL GPU box; written here, run there - the cloud has no GPU and no Chrome):
//     node tools/asset_census.js --runtime [--cold] [--secs 60] [--variant nomet] [any rollout_perf arg]
//     It writes the PAGE SIDE (PAGE_SNIPPET below) to tools/perf/asset_census_page.js, runs
//       node tools/rollout_perf.js --eval @tools/perf/asset_census_page.js --label assets_<...> ...
//     and diffs the page's answer against the static census:
//       - renderer.info: programs (and each program's name / cacheKey length), geometries, textures;
//       - the scene: meshes, DISTINCT materials (by uuid and by a parameter signature - two materials
//         that differ only by uuid are the "should have been shared" count), material types,
//         onBeforeCompile'd materials, textures by kind (image / canvas / data / array / compressed),
//         their GPU bytes (RGBA8 + mips, the same estimate the static side uses), by top-level owner;
//       - the network: the service worker's media cache keys (every /media/ URL this profile ever
//         fetched - run --cold for "this session only") and performance.getEntriesByType('resource')
//         (sizes and durations, when the 250-entry buffer did not overflow - reported);
//       - FETCHED vs IN THE SCENE: media fetched whose URL no live texture / geometry carries
//         (loaded, not used), and the static census's families never fetched at all.
//     Read with rollout_perf's own rules: one GPU benchmark on the box at a time
//     (tools/perf/GPU_BENCH.lock), and a --cold run for a first visit.
//
// NUMBERS. "GPU" = what three uploads today: every image texture as RGBA8 (4 B/px) with a full mip
// chain (x 4/3). No KTX2/Basis exists anywhere in the tree (the census says so if one appears).
// "decode ms" is PIL's on this box - a PROXY for the browser's image decode (both are libjpeg-turbo /
// libwebp), marked as such in the doc.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const TOP = +opt('top', 15);
const MD = flag('md');

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const MB = n => (n / 1048576).toFixed(n >= 10485760 ? 1 : 2);
const KB = n => (n / 1024).toFixed(0);
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

function walk(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// IMAGE HEADERS (no decode): width, height, channels, format, progressive / alpha
// ---------------------------------------------------------------------------------------------
function imageInfo(buf) {
  if (buf[0] === 0xFF && buf[1] === 0xD8) {                       // JPEG: walk to the SOF marker
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
        return { fmt: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), ch: buf[i + 9], prog: m === 0xC2, alpha: false };
      i += 2 + len;
    }
    return { fmt: 'jpg', w: 0, h: 0, ch: 0 };
  }
  if (buf.readUInt32BE(0) === 0x89504E47) {                        // PNG: IHDR
    const ct = buf[25], CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    return { fmt: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), ch: CH[ct] || 0, depth: buf[24], alpha: ct === 4 || ct === 6, palette: ct === 3 };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const c = buf.toString('ascii', 12, 16);
    if (c === 'VP8 ') return { fmt: 'webp', lossy: true, w: buf.readUInt16LE(26) & 0x3FFF, h: buf.readUInt16LE(28) & 0x3FFF, ch: 3, alpha: false };
    if (c === 'VP8L') {
      const b = buf.slice(21, 25);
      return { fmt: 'webp', lossy: false, w: 1 + (b[0] | ((b[1] & 0x3F) << 8)), h: 1 + ((b[1] >> 6) | (b[2] << 2) | ((b[3] & 0x0F) << 10)), ch: (b[3] & 0x10) ? 4 : 3, alpha: !!(b[3] & 0x10) };
    }
    if (c === 'VP8X') {
      const alpha = !!(buf[20] & 0x10);
      return { fmt: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), ch: alpha ? 4 : 3, alpha, lossy: buf.indexOf('VP8L') < 0 };
    }
  }
  if (buf.toString('ascii', 1, 7) === 'KTX 20' || buf.readUInt32LE(0) === 0x00134273) return { fmt: 'ktx2/basis', gpu: true, w: 0, h: 0 };
  return null;
}
const isPOT = n => n > 0 && (n & (n - 1)) === 0;
const gpuBytes = (w, h) => Math.round(w * h * 4 * 4 / 3);          // RGBA8 + mips: what three uploads today

// the texture's ROLE from its name (the bakers' own suffixes: _diff/_base/_col, _nor/_nor_gl/_normal,
// _rough/_arm/_orm/_ao/_metal, _disp/_height, _paint/_mask/_alpha/_opacity)
function roleOf(name) {
  const n = name.toLowerCase().replace(/\.[0-9a-f]{8}\.(jpg|png|webp)$/, '').replace(/[-\s]+/g, '_');
  if (/(^|_)(nor|nrm|normal|nor_gl|nor_dx)(_|$)/.test(n)) return 'normal';
  if (/(^|_)(rough|roughness|arm|orm|ao|metal|metallic|metalness|spec|specular|gloss|glossiness|occlusion)(_|$)/.test(n)) return 'data';
  if (/(^|_)(disp|height|bump)(_|$)/.test(n)) return 'height';
  if (/(^|_)(paint|mask|alpha|opacity|trans)(_|$)/.test(n)) return 'mask';
  return 'color';
}
// the stem a texture shares with its other SIZES (name_512 / name_1k / name_2k) and its other ROLES
const stemOf = name => name.replace(/\.[0-9a-f]{8}\.(jpg|png|webp)$/, '').replace(/_(\d+k|\d{3,4})$/i, '');
const setOf = name => stemOf(name).replace(/_(diff|base|col|color|albedo|nor|nor_gl|nor_dx|normal|rough|roughness|arm|orm|ao|metal|disp|height|paint|mask|alpha|opacity)$/i, '');

// ---------------------------------------------------------------------------------------------
// WHO NAMES WHAT: every text file that can carry a media/ path, and what the shipped page loads
// ---------------------------------------------------------------------------------------------
const REF_RE = /media\/[A-Za-z0-9_\-./]+?\.(?:jpg|png|webp|bin|ktx2|basis)/g;
function refScan() {
  const files = walk(path.join(ROOT, 'src')).filter(f => /\.(js|json)$/.test(f))
    .concat(fs.readdirSync(path.join(ROOT, 'tools')).filter(f => /^_.*\.js$/.test(f)).map(f => path.join(ROOT, 'tools', f)));
  const refs = new Map();                                         // media path -> [manifest, ...]
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of new Set(txt.match(REF_RE) || [])) {
      if (!refs.has(m)) refs.set(m, []);
      refs.get(m).push(rel(f));
    }
  }
  return refs;
}
// the manifests the SHIPPED PAGE references (build.js MANIFEST + world_packs.json): a media file named
// only by a manifest outside this set ships to Pages but no page ever asks for it
function shippedManifests() {
  const out = new Set();
  let M;
  try { M = require('./build.js').MANIFEST; } catch (e) { return { set: out, err: e.message }; }
  for (const f of M.models) out.add('src/models/' + f);
  for (const f of M.props) out.add('src/props/' + f);
  for (const f of M.panelhw) out.add('src/panelhw/' + f);
  for (const f of M.chars) out.add('src/chars/' + f);
  for (const f of M.animals) out.add('src/animals/' + f);
  for (const [d, f] of M.world) out.add(d + '/' + f);
  for (const f of M.viewer.scripts) out.add('src/viewer/' + f);
  out.add('src/viewer/' + M.viewer.shots);
  out.add('src/core/world_packs.json');   // fetched by the ISLAND_LOADER (build.js)
  out.add('src/core/trees_pack.json');    // inlined into trees_pack.js's reader (checked below)
  for (const f of (M.editor || [])) out.add('tools/' + f);
  return { set: out, M };
}

// ---------------------------------------------------------------------------------------------
// THE DECODE PASS (--decode): python + PIL, one process, every image: 16x16 grey thumbnail, the
// mean colour, whether the RGB channels are equal (a grey map shipped as RGB), decode ms
// ---------------------------------------------------------------------------------------------
const PY = String.raw`
import sys, json, time
from PIL import Image, ImageStat
out = {}
for p in sys.stdin.read().splitlines():
    try:
        t0 = time.perf_counter()
        im = Image.open(p); im.load()
        ms = (time.perf_counter() - t0) * 1000
        mode = im.mode
        rgb = im.convert('RGB')
        r, g, b = rgb.split()
        grey = r.tobytes() == g.tobytes() == b.tobytes()
        alpha_used = False
        if mode in ('RGBA', 'LA', 'PA') or (mode == 'P' and 'transparency' in im.info):
            a = im.convert('RGBA').getchannel('A').getextrema()
            alpha_used = a[0] < 255
        small = rgb.resize((min(256, rgb.width), min(256, rgb.height)), Image.BOX)
        st = ImageStat.Stat(small)
        thumb = small.resize((32, 32), Image.BOX)
        th = thumb.tobytes()
        tstd = max(ImageStat.Stat(thumb).stddev)
        out[p] = {'ms': round(ms, 2), 'mode': mode, 'grey': grey, 'alphaUsed': alpha_used, 'th': th.hex(),
                  'mean': [round(x) for x in st.mean], 'std': round(max(st.stddev), 2), 'tstd': round(tstd, 2)}
    except Exception as e:
        out[p] = {'err': str(e)}
json.dump(out, sys.stdout)
`;
function decodePass(paths) {
  const py = ['python3', 'python'].find(p => spawnSync(p, ['-c', 'import PIL'], { encoding: 'utf8' }).status === 0);
  if (!py) return { err: 'python with PIL not found (pip install pillow): --decode skipped', noPIL: true };
  const r = spawnSync(py, ['-c', PY], { input: paths.join('\n'), encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) return { err: r.stderr.slice(0, 400) };
  return { data: JSON.parse(r.stdout) };
}
// near-duplicates: same aspect and role, 32x32 RGB thumbnails within an RMS of NEAR_RMS levels
// AND mean colours within NEAR_MEAN - "the same picture", at any size (a downscale keeps the
// thumbnail). A map with too little structure at 32x32 (thumbnail std under THUMB_STD - a flat
// or fine-noise map, most normal and roughness maps) is left out: two such maps "match" and say
// nothing. Flat maps (every channel's std under FLAT_STD at 256 px) are their own finding.
const NEAR_RMS = 5, NEAR_MEAN = 6, FLAT_STD = 2, THUMB_STD = 10;
function nearDupes(tex) {
  const withTh = tex.filter(t => t.th && t.tstd >= THUMB_STD);
  const groups = [], seen = new Set();
  const thb = new Map(withTh.map(t => [t, Buffer.from(t.th, 'hex')]));
  for (let i = 0; i < withTh.length; i++) {
    const a = withTh[i]; if (seen.has(a)) continue;
    const g = [a];
    for (let j = i + 1; j < withTh.length; j++) {
      const b = withTh[j]; if (seen.has(b)) continue;
      if (Math.abs(a.w / a.h - b.w / b.h) > 0.02) continue;
      if (a.role !== b.role) continue;
      if (Math.max(...a.mean.map((m, k) => Math.abs(m - b.mean[k]))) > NEAR_MEAN) continue;
      const A = thb.get(a), B = thb.get(b); let s = 0;
      for (let k = 0; k < A.length; k++) { const d = A[k] - B[k]; s += d * d; }
      if (Math.sqrt(s / A.length) <= NEAR_RMS) g.push(b);
    }
    if (g.length > 1) { g.forEach(x => seen.add(x)); groups.push(g); }
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------
// MESH BINS: size, gzip or raw, family; the vertex/triangle counts the manifests carry
// ---------------------------------------------------------------------------------------------
function meshInfo(buf, gzWire) {
  const gz = buf[0] === 0x1F && buf[1] === 0x8B;
  let raw = buf.length, ms = 0, gzBytes = buf.length;
  if (gz) { const t0 = process.hrtime.bigint(); raw = zlib.gunzipSync(buf).length; ms = Number(process.hrtime.bigint() - t0) / 1e6; }
  // what the WIRE would carry if the file were one gzip stream, as the world pack's are: GitHub Pages
  // compresses text types only, and a .bin is served as application/octet-stream - raw
  else if (gzWire) gzBytes = zlib.gzipSync(buf, { level: 6 }).length;
  return { gz, raw, gunzipMs: ms, gzBytes };
}

// ---------------------------------------------------------------------------------------------
// MESH PAYLOADS: every manifest evaluated with stub registrars (no THREE), the counts it carries.
// The props-format header (nv, nt as u32 at each part's off) matches the manifest for every pack
// (checked for this study); chars/animals carry counts in the manifest only.
// ---------------------------------------------------------------------------------------------
function meshPayloads() {
  const vm = require('vm');
  const items = [];                 // { fam, key, tris, verts, parts, mats, lodOf, lodDist, bin, srcNt }
  const load = (file, fam) => {
    const got = [];
    const ctx = { registerPropPack: p => got.push(['pack', p]), registerChar: c => got.push(['char', c]), registerCharAnim: () => {},
      registerAnimal: a => got.push(['animal', a]), registerAnimalClips: () => {}, module: { exports: {} }, console: { log() {}, warn() {} }, window: {} };
    ctx.exports = ctx.module.exports; ctx.globalThis = ctx;
    try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file }); } catch (e) { items.push({ fam, key: path.basename(file), err: e.message }); return; }
    for (const [k, v] of Object.entries(ctx.module.exports)) if (v && v.groups) got.push(['model', v]);
    for (const [kind, p] of got) {
      if (kind === 'pack') for (const k of p.order || Object.keys(p.props || {})) { const q = p.props[k]; if (!q) continue;
        items.push({ fam, key: k, tris: q.nt || sum(q.parts || [], x => x.nt), verts: q.nv || sum(q.parts || [], x => x.nv), parts: (q.parts || []).length,
          mats: new Set((q.parts || []).map(x => x.mat)).size, lodOf: q.lodOf || null, lodDist: q.lodDist || null, srcNt: q.srcNt || null, bin: q.bin, texs: q.texs ? Object.keys(q.texs).length : 0 }); }
      else if (kind === 'model') { const gs = Object.values(p.groups); items.push({ fam, key: path.basename(file, '_model.js'), tris: sum(gs, g => g.nt), verts: sum(gs, g => g.nv), parts: gs.length, mats: new Set(gs.map(g => g.mat)).size, bin: p.bin, texs: p.texs ? Object.keys(p.texs).length : 0 }); }
      else if (kind === 'char' || kind === 'animal') { const ms = p.meshes || []; items.push({ fam, key: p.key, tris: p.nt || sum(ms, m => m.nt), verts: p.nv || sum(ms, m => m.nv), parts: ms.length, mats: new Set(ms.map(m => m.mat)).size, bin: p.bin, skinned: ms.some(m => m.skin) || kind === 'char' }); }
    }
  };
  const packs = (dir, json) => { const f = path.join(ROOT, 'src', dir, json); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map(x => path.join(ROOT, 'src', dir, x)) : []; };
  for (const f of packs('props', 'props_packs.json')) load(f, path.basename(f) === 'props_airframe.js' ? 'airframe' : 'props');
  for (const f of packs('pier', 'pier_packs.json')) load(f, path.basename(f) === 'pier_lods.js' ? 'pier_lod' : 'pier');
  for (const f of packs('totems', 'totems_packs.json')) load(f, 'totems');
  for (const f of packs('cabin', 'cabin_packs.json')) load(f, 'cabin');
  for (const f of packs('panelhw', 'panelhw_packs.json')) load(f, 'panelhw');
  for (const f of packs('animals', 'animals_packs.json')) load(f, 'animal_lod');
  for (const f of packs('animals', 'animals_index.json')) load(f, 'animals');
  for (const f of packs('chars', 'chars_index.json').filter(f => /_char\.js$/.test(f))) load(f, 'chars');
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'models')).filter(f => /_model\.js$/.test(f))) load(path.join(ROOT, 'src', 'models', f), 'models');
  // the trees: subjects x rungs (the rung L0 is the as-shipped mesh; L1/L2 are the baker's)
  const T = path.join(ROOT, 'src', 'core', 'trees_pack.json');
  if (fs.existsSync(T)) for (const c of JSON.parse(fs.readFileSync(T, 'utf8')).collections || [])
    for (const sj of c.subjects || []) items.push({ fam: 'trees', key: c.name + '/' + sj.name, tris: sj.tris, rungs: (sj.rungs || []).map(r => r.tris), stand: sj.stand ? (sj.stand.tris || null) : null,
      parts: sj.rungs && sj.rungs[0] ? sj.rungs[0].parts.length : 0, mats: sj.rungs && sj.rungs[0] ? new Set(sj.rungs[0].parts.map(p => p.mat)).size : 0, bin: c.bin, kind: c.kind });
  return items;
}

// ---------------------------------------------------------------------------------------------
// BIOME REACH: which tree / cover / rock collections a SHIPPED island's terrain types can plant
// (trees_pack.json biomes: map ttype -> mix -> species). A collection in no mapped mix is planted
// on that island only if another consumer names it (cover_ring's grass, cliffs.js's cliff faces -
// the runtime census says which); its bin and its textures are the prune / lazy-load candidates.
// ---------------------------------------------------------------------------------------------
function biomeReach() {
  const f = path.join(ROOT, 'src', 'core', 'trees_pack.json');
  if (!fs.existsSync(f)) return null;
  const T = JSON.parse(fs.readFileSync(f, 'utf8')), B = T.biomes || {};
  const mapped = new Set(Object.values(B.map || {}));
  const inMapped = new Set(), inAny = new Set();
  for (const [n, m] of Object.entries(B.mixes || {})) for (const k of Object.keys(m.species || {})) { inAny.add(k); if (mapped.has(n)) inMapped.add(k); }
  // a collection's textures: the file's material table, the maps its rung parts name
  const texOf = c => { const mt = (T.materials || {})[c.file] || {}; const used = new Set();
    for (const sj of c.subjects || []) for (const r of (sj.rungs || []).concat(sj.stand ? [sj.stand] : [], sj.snag ? [sj.snag] : [])) for (const p of (r.parts || [])) used.add(p.mat);
    const paths = new Set(); for (const k of used) { const m = mt[k]; if (m) for (const v of Object.values(m)) if (typeof v === 'string' && v.startsWith('media/')) paths.add(v); }
    return [...paths]; };
  const size = p => { try { return fs.statSync(path.join(ROOT, p)).size; } catch (e) { return 0; } };
  const rows = (T.collections || []).map(c => { const tx = texOf(c);
    return { name: c.name, kind: c.kind, file: c.file, subjects: (c.subjects || []).length, binBytes: c.bin ? size(c.bin) : 0, tex: tx.length, texBytes: sum(tx, size),
      texGpu: sum(tx, p => { try { const i = imageInfo(fs.readFileSync(path.join(ROOT, p))); return i ? gpuBytes(i.w, i.h) : 0; } catch (e) { return 0; } }),
      mapped: inMapped.has(c.name), inAnyMix: inAny.has(c.name) }; });
  return { map: B.map || {}, mixes: Object.keys(B.mixes || {}), mappedMixes: [...mapped], unmappedMixes: Object.keys(B.mixes || {}).filter(n => !mapped.has(n)), rows };
}

// ---------------------------------------------------------------------------------------------
// MATERIAL FACTORIES (static): the CODE SITES that make materials, textures, programs, instances.
// A site is not an instance count (a site in a loop makes thousands); the doc pairs these with the
// instance counts measured at runtime (--runtime) and by the node harness (--houses).
// ---------------------------------------------------------------------------------------------
const MAT_RE = /new THREE\.(Mesh(?:Basic|Lambert|Phong|Standard|Physical|Toon|Matcap|Depth|Distance|Normal)Material|ShaderMaterial|RawShaderMaterial|PointsMaterial|LineBasicMaterial|LineDashedMaterial|SpriteMaterial|ShadowMaterial)\b/g;
function materialSites() {
  const files = walk(path.join(ROOT, 'src')).filter(f => /\.js$/.test(f) && !/_(model|char|anim|animal)\.js$|props_|pier_|totems_|panelhw_|cabin_cabin/.test(path.basename(f)))
    .concat(fs.readdirSync(path.join(ROOT, 'tools')).filter(f => /^_.*_(gen|kit)\.js$/.test(f)).map(f => path.join(ROOT, 'tools', f)));
  const rows = [];
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    const kinds = {};
    for (const m of t.match(MAT_RE) || []) { const k = m.slice(10); kinds[k] = (kinds[k] || 0) + 1; }
    const n = sum(Object.values(kinds));
    const c = re => (t.match(re) || []).length;
    const r = { file: rel(f), sites: n, kinds,
      clone: c(/[Mm]at\w*\.clone\(\)|material\.clone\(\)/g),
      obc: c(/onBeforeCompile\s*=/g), cpck: c(/customProgramCacheKey/g),
      texLoad: c(/new THREE\.TextureLoader|\.loadAsync\(|loadTex\w*\(/g),
      canvasTex: c(/new THREE\.CanvasTexture/g), dataTex: c(/new THREE\.Data(?:Array|3D)?Texture/g),
      compressed: c(/CompressedTexture|KTX2Loader/g),
      inst: c(/new THREE\.InstancedMesh/g), batched: c(/new THREE\.BatchedMesh/g),
      merge: c(/mergeGeometries|mergeBufferGeometries|mergeStill|mergeByMaterial/g),
      matCache: c(/(?:MAT|mat|material)s?(?:Cache|CACHE|_POOL|Pool)\b|new Map\(\)\s*;?\s*\/\/[^\n]*material/g) };
    if (n || r.obc || r.inst || r.batched || r.canvasTex || r.dataTex) rows.push(r);
  }
  return rows.sort((a, b) => b.sites - a.sites);
}

// ---------------------------------------------------------------------------------------------
// THE HOUSES' MATERIALS, counted by running the generator (node, the gate's stub THREE -
// tools/_house_check.js's harness, as ARCH-2026-09-27.probes/house_probe.js does)
// ---------------------------------------------------------------------------------------------
function houseMaterials() {
  try {
    const vm = require('vm');
    const TOOLS = __dirname;
    const src = fs.readFileSync(path.join(TOOLS, '_house_check.js'), 'utf8');
    const a = src.indexOf('function makeTHREE()'), b = src.indexOf('const win = {};');
    if (a < 0 || b < 0) return { err: "_house_check.js's stub THREE moved" };
    const makeTHREE = new Function(src.slice(a, b) + '; return makeTHREE;')();
    const win = {};
    const ctx = { window: win, THREE: makeTHREE(), console: { log() {}, warn() {}, error() {} }, Math, JSON, Float32Array, Uint8Array, Uint16Array, Uint32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
    ctx.globalThis = ctx; vm.createContext(ctx);
    for (const f of ['_house_kit.js', '_house_gen.js', '_shed_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_tram_gen.js', '_sport_gen.js', '_marine_gen.js', '_hangar_gen.js', '_tower_gen.js'])
      vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
    const HG = win.HOUSE_GEN;
    if (!HG) return { err: 'HOUSE_GEN did not load' };
    const out = { presets: 0, bags: HG.BAGS ? HG.BAGS.length : null, bagNames: HG.BAGS || null, finish: null };
    out.presets = Object.keys(HG.PRESETS || {}).length;
    // A FINISH PER HOUSE (render_premises.js buildHouse: HG.makeFinish() + applyFinish(P, F) for every
    // house, a second one for its outbuilding): how many materials one finish holds, how many of its
    // values are per-house UNIFORMS (which is what forbids sharing the material), and - over every
    // preset - how many of those materials are distinct once the uniform values are read as data
    if (typeof HG.makeFinish === 'function' && typeof HG.applyFinish === 'function') {
      const uv = u => { const v = u && u.value; return v == null ? null : typeof v === 'number' ? +v.toFixed(4) : v.isColor || v.r != null ? [v.r, v.g, v.b].map(x => +(+x).toFixed(3)) : typeof v === 'object' ? (v.isTexture ? 'tex' : Object.values(v).slice(0, 4)) : v; };
      const uset = U => Object.fromEntries(Object.entries(U || {}).map(([k, u]) => [k, uv(u)]));
      const col = c => c ? (c.r != null ? [c.r, c.g, c.b].map(x => +(+x).toFixed(3)) : c) : null;
      const matSig = (m, F) => JSON.stringify([m.type || m.constructor.name, col(m.color), m.roughness, m.metalness, m.transparent, m.side,
        m.userData && m.userData.dirt ? uset(m.userData.dirt) : null]);
      const programSig = m => JSON.stringify([m.type, m.transparent, !!(m.userData && m.userData.dirt), m.userData && Object.keys(m.userData).sort().join(',')]);
      const sigs = new Set(), progs = new Set(), shadeSets = new Set(); let houses = 0, mats = 0, uniformsPerHouse = 0, matsPerHouse = 0;
      for (const n of Object.keys(HG.PRESETS)) {
        const p = HG.PRESETS[n]; if (p.mill || p.station) continue;
        const P = Object.assign({}, HG.DEF, p, p.wing ? { wing: 0 } : {});
        const F = HG.makeFinish();
        try { HG.applyFinish(P, F); } catch (e) { out.finishErr = e.message; break; }
        houses++;
        const ms = Object.values(F.MAT).filter(m => m && typeof m === 'object' && !m.isTexture);   // the stub's Mat carries no .type
        matsPerHouse = ms.length; mats += ms.length;
        let u = Object.keys(F.SHADE_U || {}).length + Object.keys(F.GLASS_U || {}).length + Object.keys(F.SMOKE_U || {}).length;
        for (const m of ms) if (m.userData && m.userData.dirt) u += Object.keys(m.userData.dirt).length;
        uniformsPerHouse = Math.max(uniformsPerHouse, u);
        const sh = JSON.stringify(uset(F.SHADE_U)) + JSON.stringify(uset(F.GLASS_U));
        shadeSets.add(sh);
        for (const m of ms) { sigs.add(matSig(m) + sh); progs.add(programSig(m)); }
      }
      out.finish = { houses, materialsPerFinish: matsPerHouse, materialsMade: mats, perHouseUniformValues: uniformsPerHouse,
        distinctMaterialsIfUniformsAreData: sigs.size, distinctShadeSets: shadeSets.size, programShapes: progs.size };
    }
    return out;
  } catch (e) { return { err: e.message }; }
}

// ---------------------------------------------------------------------------------------------
// THE BOOT'S WORLD FETCH: world_packs.json - bytes shipped, decoded, and gunzip ms in node
// ---------------------------------------------------------------------------------------------
const worldTtype = {};
function worldLoad() {
  const f = path.join(ROOT, 'src', 'core', 'world_packs.json');
  if (!fs.existsSync(f)) return [];
  const P = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = [];
  for (const isl of P.islands || []) {
    for (const [k, r] of Object.entries(isl.files || {})) {
      if (!r.src) { rows.push({ island: isl.id, key: k, inline: true, ship: 0, raw: JSON.stringify(r.json || '').length, ms: 0 }); continue; }
      const p = path.join(ROOT, r.src);
      if (!fs.existsSync(p)) { rows.push({ island: isl.id, key: k, missing: true }); continue; }
      const buf = fs.readFileSync(p);
      const t0 = process.hrtime.bigint(); const u = zlib.gunzipSync(buf); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      rows.push({ island: isl.id, key: k, src: r.src, ship: buf.length, raw: u.length, ms: +ms.toFixed(1), fetched: 'boot' });
    }
    // what the boot DECODES the terrain into: 19_terrain_codec.js decodeRaw keeps (patch+1)^2 quantised samples at
    // EVERY node, internal ones included - an Int32Array since AS1 (G905; a Float64Array before) - measured, not estimated
    try {
      const codec = require(path.join(ROOT, 'src', 'core', '19_terrain_codec.js'));
      const F = isl.files;
      for (const [h, t, pl] of [['header', 'topo', 'payload'], ['far.header', 'far.topo', 'far.payload']]) {
        if (!F[h] || !F[t] || !F[pl]) continue;
        const topo = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, F[t].src))), raw = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, F[pl].src)));
        const t0 = process.hrtime.bigint(); const tree = codec.decodeRaw(F[h].json, topo, raw); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        let nodes = 0, bytes = 0; const w = n => { nodes++; bytes += (n.q || n.h).byteLength; if (n.kids) n.kids.forEach(w); }; w(tree);
        rows.push({ island: isl.id, key: 'decoded quadtree ' + (h === 'header' ? 'e2 (near)' : 'e4 (far)'), ship: 0, raw: bytes, ms: +ms.toFixed(0), fetched: nodes + ' nodes x ' + (tree.q ? 'Int32 ' : 'Float64 ') + (F[h].json.patch + 1) + '^2 (19_terrain_codec.js decodeRaw)' });
      }
    } catch (e) { rows.push({ island: isl.id, key: 'decoded quadtree', err: e.message }); }
    // the terrain types the GRID holds (the biomes a Jolene flight can meet without the premises' stamps)
    try {
      if (isl.files['grid.ttype']) { const T = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, isl.files['grid.ttype'].src))); const h = new Array(256).fill(0); for (const v of T) h[v]++;
        worldTtype[isl.id] = h.map((n, c) => [c, n]).filter(x => x[1]); }
    } catch (e) {}
    for (const [k, r] of Object.entries(isl.authoring || {})) {
      const p = path.join(ROOT, r.src);
      rows.push({ island: isl.id, key: 'authoring.' + k, src: r.src, ship: fs.existsSync(p) ? fs.statSync(p).size : 0, raw: r.raw, ms: 0, fetched: 'never (authoring only; deployed to Pages)' });
    }
  }
  return rows;
}

// =============================================================================================
// THE STATIC CENSUS. The options default to the command line's flags; GATE ASSETS (G900,
// tools/_asset_check.js) asks for the cheap subset: { decode: true, gz: false, payloads: false,
// houses: false, world: false } - the files, their headers, the duplicates, the flat maps (when
// PIL is there) and the material sites, ~2 s + the decode pass.
// =============================================================================================
function staticCensus(o) {
  o = Object.assign({ decode: flag('decode'), gz: !flag('no-gz'), houses: !flag('no-houses'), payloads: true, biomes: true, world: true }, o || {});
  const t0 = Date.now();
  const refs = refScan();
  const shipped = shippedManifests();
  const media = walk(path.join(ROOT, 'media')).concat(walk(path.join(ROOT, 'assets')));
  const tex = [], mesh = [], other = [];
  const byHash = new Map();
  for (const p of media) {
    const r = rel(p), buf = fs.readFileSync(p), name = path.basename(p);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const fam = r.startsWith('assets/') ? r.split('/').slice(0, 2).join('/') + ' (bake source)' : r.split('/').slice(0, 3).join('/');
    const who = refs.get(r) || [];
    const shippedBy = who.filter(m => shipped.set.has(m));
    const row = { path: r, fam, bytes: buf.length, sha: sha.slice(0, 16), refs: who, shippedRefs: shippedBy.length };
    if (!byHash.has(sha)) byHash.set(sha, []);
    byHash.get(sha).push(row);
    const ii = /\.(jpg|jpeg|png|webp|ktx2|basis)$/i.test(name) ? imageInfo(buf) : null;
    if (ii) {
      Object.assign(row, ii, { role: roleOf(name), stem: stemOf(name), set: setOf(name), pot: isPOT(ii.w) && isPOT(ii.h), gpu: gpuBytes(ii.w, ii.h) });
      tex.push(row);
    } else if (/\.bin$/.test(name) && r.startsWith('media/geo/')) { Object.assign(row, meshInfo(buf, o.gz)); mesh.push(row); }
    else if (/\.obj$/i.test(name)) {
      const t = buf.toString('utf8'); let v = 0, fcount = 0, tri = 0;
      for (const line of t.split('\n')) { if (line.startsWith('v ')) v++; else if (line.startsWith('f ')) { fcount++; tri += line.trim().split(/\s+/).length - 3; } }
      Object.assign(row, { obj: true, verts: v, faces: fcount, tris: tri }); mesh.push(row);
    } else other.push(row);
  }
  let dec = null;
  if (o.decode) {
    dec = decodePass(tex.map(t => path.join(ROOT, t.path)));
    if (dec.data) for (const t of tex) { const d = dec.data[path.join(ROOT, t.path)]; if (d && !d.err) Object.assign(t, d); }
  }
  const exactDupes = [...byHash.values()].filter(g => g.length > 1);
  const near = dec && dec.data ? nearDupes(tex) : null;
  // the same STEM at several sizes (a 512 and a 1k of one map): the bakers' own naming says so
  const byStem = new Map();
  for (const t of tex) { const k = path.dirname(t.path) + '/' + t.stem; if (!byStem.has(k)) byStem.set(k, []); byStem.get(k).push(t); }
  const multiSize = [...byStem.values()].filter(g => new Set(g.map(t => t.w + 'x' + t.h)).size > 1);
  return { ms: Date.now() - t0, tex, mesh, other, exactDupes, near, multiSize, decodeErr: dec && dec.err, decodeNoPIL: !!(dec && dec.noPIL),
    payloads: o.payloads ? meshPayloads() : null, biomes: o.biomes ? biomeReach() : null, materials: materialSites(), houses: o.houses ? houseMaterials() : null, world: o.world ? worldLoad() : [], worldTtype, shippedErr: shipped.err,
    shippedManifestCount: shipped.set.size };
}

// ---------------------------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------------------------
function table(head, rows) {
  if (MD) return ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'].concat(rows.map(r => '| ' + r.join(' | ') + ' |')).join('\n');
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => (i ? String(c).padStart(w[i]) : String(c).padEnd(w[i]))).join('  ');
  return [line(head), w.map(n => '-'.repeat(n)).join('  ')].concat(rows.map(line)).join('\n');
}
function group(arr, key) { const m = new Map(); for (const x of arr) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

function report(C) {
  const out = [];
  const H = s => out.push('\n' + (MD ? '#### ' : '== ') + s);
  const tex = C.tex;
  // 1. textures by family
  H(`TEXTURES: ${tex.length} files, ${MB(sum(tex, t => t.bytes))} MB shipped, ${MB(sum(tex, t => t.gpu))} MB GPU if all resident (RGBA8 + mips); GPU-compressed: ${tex.filter(t => t.gpu === true || t.fmt === 'ktx2/basis').length}`);
  const fam = [...group(tex, t => t.fam).entries()].map(([f, a]) => ({ f, a, bytes: sum(a, t => t.bytes), gpu: sum(a, t => t.gpu) })).sort((x, y) => y.gpu - x.gpu);
  out.push(table(['family', 'files', 'shipped MB', 'GPU MB', 'jpg/png/webp', 'max px', 'NPOT', 'roles c/n/d/m/h', 'unshipped refs'],
    fam.map(({ f, a, bytes, gpu }) => [f, a.length, MB(bytes), MB(gpu),
      ['jpg', 'png', 'webp'].map(k => a.filter(t => t.fmt === k).length).join('/'),
      Math.max(...a.map(t => Math.max(t.w, t.h))), a.filter(t => !t.pot).length,
      ['color', 'normal', 'data', 'mask', 'height'].map(k => a.filter(t => t.role === k).length).join('/'),
      a.filter(t => !t.shippedRefs).length])));
  // resolution histogram
  const res = [...group(tex, t => Math.max(t.w, t.h)).entries()].sort((a, b) => b[0] - a[0]);
  H('TEXTURES BY LARGEST SIDE');
  out.push(table(['px', 'files', 'shipped MB', 'GPU MB'], res.map(([px, a]) => [px, a.length, MB(sum(a, t => t.bytes)), MB(sum(a, t => t.gpu))])));
  // the biggest single textures
  H(`THE ${TOP} HEAVIEST TEXTURES ON THE GPU`);
  out.push(table(['path', 'px', 'fmt', 'KB', 'GPU MB', 'role'], tex.slice().sort((a, b) => b.gpu - a.gpu).slice(0, TOP)
    .map(t => [t.path, t.w + 'x' + t.h, t.fmt + (t.alpha ? '+a' : ''), KB(t.bytes), MB(t.gpu), t.role])));
  // normal maps as JPEG, grey maps as RGB, alpha-less PNGs: the encoding findings
  const jpgNormals = tex.filter(t => t.role === 'normal' && t.fmt === 'jpg');
  const greyRgb = tex.filter(t => t.grey && t.ch >= 3);
  const pngNoAlpha = tex.filter(t => t.fmt === 'png' && (t.alphaUsed === false || (!t.alpha && t.alphaUsed == null)));
  const dataMaps = tex.filter(t => t.role === 'data');
  H('ENCODING');
  out.push(table(['finding', 'files', 'shipped MB', 'GPU MB'], [
    ['normal maps stored as JPEG (lossy 8x8 blocks in a vector field)', jpgNormals.length, MB(sum(jpgNormals, t => t.bytes)), MB(sum(jpgNormals, t => t.gpu))],
    ['single-channel data maps (rough/ao/metal/arm) as separate files', dataMaps.length, MB(sum(dataMaps, t => t.bytes)), MB(sum(dataMaps, t => t.gpu))],
    ['grey images stored with 3+ channels' + (C.near ? '' : ' (needs --decode)'), C.near ? greyRgb.length : '-', C.near ? MB(sum(greyRgb, t => t.bytes)) : '-', C.near ? MB(sum(greyRgb, t => t.gpu)) : '-'],
    ['PNG with no alpha in use' + (C.near ? '' : ' (header only)'), pngNoAlpha.length, MB(sum(pngNoAlpha, t => t.bytes)), MB(sum(pngNoAlpha, t => t.gpu))],
    ['FLAT maps (a constant shipped as a texture; std < ' + FLAT_STD + ')' + (C.near ? '' : ' (needs --decode)'), C.near ? tex.filter(t => t.std != null && t.std < FLAT_STD).length : '-', C.near ? MB(sum(tex.filter(t => t.std != null && t.std < FLAT_STD), t => t.bytes)) : '-', C.near ? MB(sum(tex.filter(t => t.std != null && t.std < FLAT_STD), t => t.gpu)) : '-'],
    ['non-power-of-two', tex.filter(t => !t.pot).length, MB(sum(tex.filter(t => !t.pot), t => t.bytes)), MB(sum(tex.filter(t => !t.pot), t => t.gpu))],
    ['GPU-compressed (KTX2 / Basis)', tex.filter(t => t.fmt === 'ktx2/basis').length, '-', '-']]));
  if (C.near) {
    const flat = tex.filter(t => t.std != null && t.std < FLAT_STD).sort((a, b) => b.gpu - a.gpu);
    out.push(table(['flat map', 'px', 'KB', 'GPU MB', 'mean rgb'], flat.slice(0, TOP).map(t => [t.path, t.w + 'x' + t.h, KB(t.bytes), MB(t.gpu), t.mean.join(',')])));
  }
  // 2. duplicates
  const texDup = C.exactDupes.filter(g => imageInfo(fs.readFileSync(path.join(ROOT, g[0].path))));
  H(`EXACT DUPLICATES (same bytes, several paths): ${C.exactDupes.length} groups, ${MB(sum(C.exactDupes, g => g[0].bytes * (g.length - 1)))} MB redundant`);
  out.push(table(['copies', 'KB each', 'paths'], C.exactDupes.sort((a, b) => b[0].bytes * b.length - a[0].bytes * a.length).slice(0, TOP)
    .map(g => [g.length, KB(g[0].bytes), g.map(x => x.path).join(' , ')])));
  if (C.near) {
    const nd = C.near.map(g => ({ g, extra: sum(g, t => t.gpu) - Math.max(...g.map(t => t.gpu)), sizes: new Set(g.map(t => t.w + 'x' + t.h)).size }));
    H(`NEAR-DUPLICATES (same picture, any size; 32x32 RGB thumb RMS <= ${NEAR_RMS}, mean <= ${NEAR_MEAN}, thumb std >= ${THUMB_STD}): ${nd.length} groups, ${nd.reduce((s, x) => s + x.g.length, 0)} files, ${MB(sum(nd, x => x.extra))} MB GPU beyond the largest of each`);
    out.push(table(['n', 'sizes', 'GPU MB extra', 'paths'], nd.sort((a, b) => b.extra - a.extra).slice(0, TOP)
      .map(x => [x.g.length, x.sizes, MB(x.extra), x.g.map(t => t.path.replace(/^media\/tex\//, '') + '@' + t.w).join(' , ')])));
    const dms = tex.filter(t => t.ms != null);
    H(`DECODE (PIL on this box, a proxy for the browser): ${dms.length} images, ${(sum(dms, t => t.ms) / 1000).toFixed(1)} s total`);
    out.push(table(['family', 'files', 'decode s', 'max ms'], [...group(dms, t => t.fam).entries()].map(([f, a]) => [f, a.length, (sum(a, t => t.ms) / 1000).toFixed(2), Math.max(...a.map(t => t.ms)).toFixed(0)]).sort((a, b) => b[2] - a[2])));
  }
  if (C.multiSize.length) {
    H(`ONE MAP AT SEVERAL SIZES (by the bakers' names): ${C.multiSize.length} stems`);
    out.push(table(['stem', 'sizes'], C.multiSize.slice(0, TOP).map(g => [path.dirname(g[0].path) + '/' + g[0].stem, g.map(t => t.w + 'x' + t.h).join(' ')])));
  }
  // 3. references
  const unref = C.tex.concat(C.mesh).filter(t => !t.refs.length);
  const unshipped = C.tex.concat(C.mesh).filter(t => t.refs.length && !t.shippedRefs);
  H(`REFERENCES: ${unref.length} media files named by no src/ or tools/_* file; ${unshipped.length} named only by manifests the shipped page does not reference (${MB(sum(unshipped, t => t.bytes))} MB)`);
  out.push(table(['family', 'files', 'MB', 'named only by'], [...group(unshipped, t => t.fam).entries()].map(([f, a]) => [f, a.length, MB(sum(a, t => t.bytes)), [...new Set(a.flatMap(t => t.refs))].slice(0, 4).join(' ')])));
  // 4. meshes
  H(`MESH BINS: ${C.mesh.length} files, ${MB(sum(C.mesh, m => m.bytes))} MB shipped, ${MB(sum(C.mesh, m => m.raw || m.bytes))} MB after gunzip`);
  out.push(table(['family', 'files', 'shipped MB', 'raw MB', 'gzipped', 'as gzip MB', 'shipped by page'],
    [...group(C.mesh, m => m.fam).entries()].map(([f, a]) => [f, a.length, MB(sum(a, m => m.bytes)), MB(sum(a, m => m.raw || m.bytes)), a.filter(m => m.gz).length, MB(sum(a, m => m.gzBytes || m.bytes)), a.filter(m => m.shippedRefs).length])
      .sort((a, b) => b[2] - a[2])));
  if (C.payloads) {
    const P = C.payloads.filter(x => !x.err);
    const lodded = new Set(P.filter(x => x.lodOf).map(x => x.lodOf));
    out.push(table(['payload family', 'items', 'triangles', 'vertices', 'parts', 'max tris', 'have LODs', 'the heaviest'],
      [...group(P, x => x.fam).entries()].map(([f, a]) => {
        const base = a.filter(x => !x.lodOf), top = a.slice().sort((x, y) => y.tris - x.tris)[0];
        return [f, a.length, sum(a, x => x.tris || 0), sum(a, x => x.verts || 0), sum(a, x => x.parts || 0), top ? top.tris : 0,
          f === 'trees' ? a.filter(x => x.rungs && x.rungs.length > 1).length : base.filter(x => lodded.has(x.key)).length, top ? top.key : ''];
      })));
    const heavy = P.filter(x => !x.lodOf && x.fam !== 'trees').sort((a, b) => b.tris - a.tris).slice(0, TOP);
    out.push(table(['heaviest single payloads', 'family', 'tris', 'parts', 'LOD levels'], heavy.map(x => [x.key, x.fam, x.tris, x.parts, P.filter(y => y.lodOf === x.key).map(y => y.tris + (y.lodDist ? '@' + y.lodDist : '')).join(' ') || '-'])));
    const errs = C.payloads.filter(x => x.err);
    if (errs.length) out.push('payload manifests that did not evaluate: ' + errs.map(x => x.fam + '/' + x.key + ' (' + x.err + ')').join('; '));
  }
  const objs = C.mesh.filter(m => m.obj);
  if (objs.length) out.push(table(['OBJ (assets/)', 'MB', 'verts', 'tris', 'named by'], objs.map(m => [m.path, MB(m.bytes), m.verts, m.tris, m.refs.join(' ') || '-'])));
  if (C.biomes) {
    const off = C.biomes.rows.filter(r => !r.mapped);
    H(`BIOME REACH (Jolene's terrain-type map): mixes not mapped: ${C.biomes.unmappedMixes.join(', ') || 'none'}; ${off.length} of ${C.biomes.rows.length} collections are in no mapped mix - ${MB(sum(off, r => r.binBytes + r.texBytes))} MB shipped, ${MB(sum(off, r => r.texGpu))} MB GPU if their maps load`);
    out.push(table(['collection', 'kind', 'subjects', 'bin KB', 'maps', 'maps KB', 'maps GPU MB', 'in some mix'], off.map(r => [r.name, r.kind, r.subjects, KB(r.binBytes), r.tex, KB(r.texBytes), MB(r.texGpu), r.inAnyMix ? 'unmapped mix' : 'none'])));
    const tt = C.worldTtype && C.worldTtype.jolene;
    if (tt) out.push('terrain-type codes in Jolene\'s GRID (code: cells -> mix): ' + tt.map(([c, n]) => c + ':' + n + (C.biomes.map[c] ? '->' + C.biomes.map[c] : '')).join('  ') +
      '. Codes the map names but the grid lacks come only from derived codes (28c_biomes.js) or the premises\' ttype stamps: ' +
      Object.keys(C.biomes.map).filter(c => !tt.some(x => String(x[0]) === c)).map(c => c + '->' + C.biomes.map[c]).join(', '));
    const all = C.biomes.rows;
    out.push(`all vegetation collections: ${all.length}, bins ${MB(sum(all, r => r.binBytes))} MB, maps ${MB(sum(all, r => r.texBytes))} MB shipped / ${MB(sum(all, r => r.texGpu))} MB GPU`);
  }
  // 5. materials
  H(`MATERIAL FACTORIES (code sites, not instances): ${sum(C.materials, r => r.sites)} 'new THREE.*Material' sites in ${C.materials.length} files; onBeforeCompile ${sum(C.materials, r => r.obc)}, customProgramCacheKey ${sum(C.materials, r => r.cpck)}, InstancedMesh ${sum(C.materials, r => r.inst)}, BatchedMesh ${sum(C.materials, r => r.batched)}, CanvasTexture ${sum(C.materials, r => r.canvasTex)}, DataTexture ${sum(C.materials, r => r.dataTex)}, compressed ${sum(C.materials, r => r.compressed)}`);
  out.push(table(['file', 'sites', 'kinds', 'clone', 'oBC', 'cpck', 'Inst', 'Batch', 'Canvas', 'Data', 'merge'],
    C.materials.slice(0, Math.max(TOP, 25)).map(r => [r.file, r.sites, Object.entries(r.kinds).map(([k, n]) => k.replace(/^Mesh|Material$/g, '') + n).join(' '), r.clone, r.obc, r.cpck, r.inst, r.batched, r.canvasTex, r.dataTex, r.merge])));
  if (C.houses) {
    H('THE HOUSE GENERATOR (node, stub THREE)');
    out.push(C.houses.err ? 'error: ' + C.houses.err : JSON.stringify(C.houses));
  }
  // 6. the world pack
  H(`THE BOOT'S WORLD FETCH (world_packs.json): ${MB(sum(C.world.filter(w => w.fetched === 'boot'), w => w.ship))} MB shipped, ${MB(sum(C.world.filter(w => w.fetched === 'boot'), w => w.raw))} MB decoded, gunzip ${(sum(C.world.filter(w => w.fetched === 'boot'), w => w.ms) / 1000).toFixed(2)} s in node; the terrain quadtrees then decode to ${MB(sum(C.world.filter(w => /^decoded quadtree/.test(w.key)), w => w.raw))} MB of Float64 in ${(sum(C.world.filter(w => /^decoded quadtree/.test(w.key)), w => w.ms) / 1000).toFixed(2)} s`);
  out.push(table(['key', 'shipped MB', 'decoded MB', 'gunzip / decode ms', 'fetched'], C.world.map(w => [w.key, MB(w.ship || 0), MB(w.raw || 0), w.ms, w.err ? 'error: ' + w.err : (w.fetched || (w.inline ? 'inline' : '?'))])));
  out.push(`\n(census ${C.ms} ms; ${C.shippedManifestCount} shipped manifests${C.shippedErr ? '; build.js MANIFEST: ' + C.shippedErr : ''}${C.decodeErr ? '; decode: ' + C.decodeErr : ''})`);
  return out.join('\n');
}

// =============================================================================================
// THE RUNTIME CENSUS - the page side. One expression (a promise), rollout_perf's --eval contract
// (tools/rollout_census.js is the sibling it follows). Read, never written.
// =============================================================================================
const PAGE_SNIPPET = String.raw`(async () => {
  const W = window.WORLD, sc = W && W.scene, R = W && W.renderer;
  // THE NETWORK first, and without the scene (the garage has no WORLD yet: a census taken there still
  // reads what was fetched). Checked against boot_perf.js's CDP network log (G902): the same URLs, cut
  // the same way (the page-relative 'media/...'), with the two holes the CDP log does not have -
  //   the SW cache is the worker's (sw.js / build.js / storage.js: 'flydiy-media-v1'), registered by
  //   index.html only (never dev.html) at 'load' - and on 2026-09-27 NEVER: storage.js runs from the
  //   text/x-flydiy loader after the world fetch, ~1 s after 'load' fired, so its listener never runs
  //   (measured, HANDOVER G902). 'sw' says whether a worker controls the page; the cache is read
  //   only if it exists (caches.open would CREATE it); and resource timing keeps 250 entries unless
  //   the page raised its buffer before the first fetch (rollout_perf's pre-script does, and says so
  //   in window.__RTBUF) - a boot and a roll-out fetch more.
  let swKeys = [], swErr = null;
  try { if (await caches.has('flydiy-media-v1')) { const c = await caches.open('flydiy-media-v1'); swKeys = (await c.keys()).map(r => new URL(r.url).pathname.replace(/^.*?\/media\//, 'media/')); } } catch (e) { swErr = String(e && e.message || e); }
  const sw = (() => { try { const c = navigator.serviceWorker && navigator.serviceWorker.controller; return c ? 'controlling' : (navigator.serviceWorker ? 'not controlling' : 'unavailable'); } catch (e) { return 'unavailable'; } })();
  const res = performance.getEntriesByType('resource').map(e => ({ u: e.name.replace(/^.*?\/flyDiy\//, '').split('?')[0], t: e.initiatorType, tx: e.transferSize, enc: e.encodedBodySize, dec: e.decodedBodySize, ms: +e.duration.toFixed(1), at: +e.startTime.toFixed(0) }));
  const rtCap = window.__RTBUF || 250;
  const fetchedMedia = [...new Set(swKeys.concat(res.map(r => r.u).filter(u => u.startsWith('media/'))))];
  const fetchedTex = fetchedMedia.filter(u => /\.(jpg|png|webp|ktx2)$/.test(u));
  const famOf = u => u.split('/').slice(0, 3).join('/');
  const famCount = a => { const o = {}; for (const u of a) o[famOf(u)] = (o[famOf(u)] || 0) + 1; return Object.entries(o).sort((x, y) => y[1] - x[1]); };
  const mem = performance.memory ? { usedJSHeapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(0), totalJSHeapMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(0) } : null;
  const network = { sw, swErr, swMediaCached: swKeys.length, resourceEntries: res.length, resourceBufferSize: rtCap, resourceBufferMaybeFull: res.length >= rtCap, fetchedMedia: fetchedMedia.length, fetchedTex: fetchedTex.length,
    fetchedByFamily: famCount(fetchedMedia), top: res.filter(r => r.enc > 0).sort((a, b) => b.enc - a.enc).slice(0, 40), all: fetchedMedia };
  if (!sc || !R) return { err: 'no WORLD.scene / WORLD.renderer (the garage? the scene census runs after the roll-out) - the network only', network, memory: mem };
  const gpuB = (w, h, mips) => Math.round(w * h * 4 * (mips ? 4 / 3 : 1));
  const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'transmissionMap', 'thicknessMap', 'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'envMap'];
  const mats = new Map(), texs = new Map(), geos = new Map();
  const byTop = {}; let meshes = 0, inst = 0, instances = 0, batched = 0, hidden = 0;
  const topOf = o => { let t = o; while (t.parent && t.parent !== sc) t = t.parent; return t.name || (t.type + '#' + sc.children.indexOf(t)); };
  const texKind = t => t.isCompressedTexture ? 'compressed' : t.isDataArrayTexture ? 'array' : t.isData3DTexture ? '3d' : t.isDataTexture ? 'data' : t.isCanvasTexture || (t.image && typeof HTMLCanvasElement !== 'undefined' && t.image instanceof HTMLCanvasElement) ? 'canvas' : t.isCubeTexture ? 'cube' : t.isRenderTargetTexture || t.isFramebufferTexture ? 'target' : 'image';
  const texSize = t => { const i = t.image || {}; const w = i.width || (i.data && i.data.width) || 0, h = i.height || 0, d = i.depth || 1; return { w, h, d }; };
  const srcOf = t => { const i = t.image; const s = i && (i.currentSrc || i.src || (i.url)); return s ? String(s).replace(/^.*?(media\/)/, '$1').split('?')[0] : ''; };
  const addTex = (t, owner, slot) => { if (!t || !t.isTexture) return; let e = texs.get(t.uuid);
    if (!e) { const s = texSize(t); e = { kind: texKind(t), w: s.w, h: s.h, d: s.d, src: srcOf(t), mips: t.generateMipmaps !== false && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter, owners: new Set(), slots: new Set(), name: t.name || '' }; texs.set(t.uuid, e); }
    e.owners.add(owner); e.slots.add(slot); };
  const sig = m => { const o = [m.type, m.transparent, m.side, m.alphaTest, m.vertexColors, !!m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? String(m.onBeforeCompile).length : 0, m.customProgramCacheKey ? m.customProgramCacheKey() : ''];
    for (const k of ['color', 'emissive', 'specularColor', 'sheenColor', 'attenuationColor']) if (m[k] && m[k].getHexString) o.push(m[k].getHexString());
    for (const k of ['roughness', 'metalness', 'opacity', 'clearcoat', 'clearcoatRoughness', 'transmission', 'ior', 'envMapIntensity', 'emissiveIntensity']) if (m[k] != null) o.push(+(+m[k]).toFixed(3));
    for (const k of SLOTS) if (m[k]) o.push(k + ':' + m[k].uuid);
    if (m.uniforms) o.push(Object.keys(m.uniforms).length);
    return JSON.stringify(o); };
  sc.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) hidden++;
    const top = topOf(o); const b = byTop[top] = byTop[top] || { meshes: 0, mats: new Set(), geos: new Set(), tris: 0, inst: 0 };
    meshes++; b.meshes++;
    if (o.isInstancedMesh) { inst++; instances += o.count; b.inst += o.count; }
    if (o.isBatchedMesh) batched++;
    const g = o.geometry; if (g && !geos.has(g.uuid)) { let bytes = 0; for (const k in g.attributes) { const a = g.attributes[k]; bytes += a.array ? a.array.byteLength : 0; } if (g.index) bytes += g.index.array.byteLength;
      geos.set(g.uuid, { bytes, tris: (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3 }); }
    if (g) { b.geos.add(g.uuid); b.tris += geos.get(g.uuid).tris * (o.isInstancedMesh ? o.count : 1); }
    for (const m of (o.material ? [].concat(o.material) : [])) {
      b.mats.add(m.uuid);
      if (!mats.has(m.uuid)) { mats.set(m.uuid, { type: m.type, sig: sig(m), obc: m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile, owner: top, prog: (R.properties.get(m).currentProgram || {}).name || '' });
        for (const k of SLOTS) addTex(m[k], top, k);
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) addTex(v, top, 'u:' + k); else if (Array.isArray(v)) v.forEach(x => x && x.isTexture && addTex(x, top, 'u:' + k)); } }
    }
  });
  if (sc.background && sc.background.isTexture) addTex(sc.background, 'scene', 'background');
  if (sc.environment && sc.environment.isTexture) addTex(sc.environment, 'scene', 'environment');
  const bySig = new Map(); for (const m of mats.values()) bySig.set(m.sig, (bySig.get(m.sig) || 0) + 1);
  const byType = {}; for (const m of mats.values()) byType[m.type] = (byType[m.type] || 0) + 1;
  const texRows = [...texs.values()];
  const tb = t => gpuB(t.w, t.h * t.d, t.mips);
  const texByKind = {}; for (const t of texRows) { const k = texByKind[t.kind] = texByKind[t.kind] || { n: 0, mb: 0 }; k.n++; k.mb += tb(t) / 1048576; }
  const texByOwner = {}; for (const t of texRows) for (const o of t.owners) { const k = texByOwner[o] = texByOwner[o] || { n: 0, mb: 0 }; k.n++; k.mb += tb(t) / 1048576 / t.owners.size; }
  const progs = (R.info.programs || []).map(p => ({ name: p.name, key: (p.cacheKey || '').length, users: p.usedTimes }));
  // FETCHED vs IN THE SCENE. An image the page decoded into a DataArrayTexture (the pavement and
  // splat libraries pack theirs on the CPU) is bound by no URL: it reads as "not in the scene" here,
  // which is the family's CPU packing, not an unused fetch - the families are listed, read them so.
  const inScene = new Set(texRows.map(t => t.src).filter(Boolean));
  const notInScene = fetchedTex.filter(u => !inScene.has(u));
  Object.assign(network, { texNotInScene: notInScene.length, texNotInSceneByFamily: famCount(notInScene), texNotInSceneSample: notInScene.slice(0, 80) });
  return {
    info: { programs: progs.length, geometries: R.info.memory.geometries, textures: R.info.memory.textures, calls: R.info.render.calls, triangles: R.info.render.triangles },
    programsTop: progs.sort((a, b) => b.users - a.users).slice(0, 60),
    scene: { meshes, hidden, instancedMeshes: inst, instances, batched, materials: mats.size, materialSignatures: bySig.size, sharedIfDeduped: mats.size - bySig.size, obcMaterials: [...mats.values()].filter(m => m.obc).length, byType,
      geometries: geos.size, geometryMB: +(sum2([...geos.values()], g => g.bytes) / 1048576).toFixed(1) },
    byTop: Object.entries(byTop).map(([k, v]) => [k, v.meshes, v.mats.size, v.geos.size, Math.round(v.tris), v.inst]).sort((a, b) => b[2] - a[2]).slice(0, 40),
    textures: { n: texRows.length, gpuMB: +(sum2(texRows, tb) / 1048576).toFixed(1), byKind: texByKind, byOwner: Object.entries(texByOwner).map(([k, v]) => [k, v.n, +v.mb.toFixed(1)]).sort((a, b) => b[2] - a[2]).slice(0, 30),
      biggest: texRows.sort((a, b) => tb(b) - tb(a)).slice(0, 30).map(t => [t.src || t.name || t.kind, t.kind, t.w + 'x' + t.h + (t.d > 1 ? 'x' + t.d : ''), +(tb(t) / 1048576).toFixed(1), [...t.owners].slice(0, 3).join(',')]),
      srcs: [...inScene] },
    network,
    memory: mem, world: window.FLYDIY_WORLD, towns: (() => { try { return GFX && GFX.get ? GFX.get('towns') : null; } catch (e) { return null; } })()
  };
  function sum2(a, f) { let s = 0; for (const x of a) s += f(x); return s; }
})()`;

function runtime() {
  const perf = path.join(__dirname, 'perf');
  fs.mkdirSync(perf, { recursive: true });
  const snip = path.join(perf, 'asset_census_page.js');
  fs.writeFileSync(snip, '// written by tools/asset_census.js --runtime; rollout_perf --eval reads it\n' + PAGE_SNIPPET + '\n');
  const pass = argv.filter(a => a !== '--runtime');
  const label = 'assets_' + (pass.includes('--cold') ? 'cold' : 'warm') + '_' + (opt('variant', 'base'));
  const out = path.join(perf, 'rollout_' + label + '.json');
  const args = [path.join(__dirname, 'rollout_perf.js'), '--eval', '@' + rel(snip), '--label', label, '--out', out, '--secs', opt('secs', '60')].concat(pass.filter((a, i) => !['--secs'].includes(a) && !(i > 0 && pass[i - 1] === '--secs')));
  console.log('asset_census --runtime: node ' + args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' '));
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0 && !fs.existsSync(out)) { console.error('rollout_perf failed (' + r.status + ')'); process.exit(r.status || 1); }
  const J = JSON.parse(fs.readFileSync(out, 'utf8'));
  let E = J.eval; try { E = typeof E === 'string' ? JSON.parse(E) : E; } catch (e) { console.error('the page census did not parse: ' + String(E).slice(0, 300)); process.exit(1); }
  if (!E || (E.err && !E.network)) { console.error('page census: ' + (E && E.err)); process.exit(1); }
  // the diff against the static census: what ships, what is fetched, what is in the scene
  const S = staticCensus({ decode: false, gz: false, payloads: false, biomes: false, houses: false, world: false });
  const fetched = new Set(E.network.all), inScene = new Set(E.textures ? E.textures.srcs : []);
  const famRows = [...group(S.tex.concat(S.mesh), t => t.fam).entries()].map(([f, a]) => {
    const fe = a.filter(t => fetched.has(t.path)), sc = a.filter(t => inScene.has(t.path));
    return [f, a.length, MB(sum(a, t => t.bytes)), fe.length, MB(sum(fe, t => t.bytes)), E.err ? '-' : sc.length, E.err ? '-' : fe.filter(t => !inScene.has(t.path) && t.w).length];
  }).sort((a, b) => b[4] - a[4]);
  const o = [];
  o.push('\n== RUNTIME ASSET CENSUS (' + label + ', world ' + E.world + ', towns ' + E.towns + ')');
  const N = E.network;
  if (E.err) o.push('NO SCENE CENSUS: ' + E.err);
  else {
    o.push('renderer.info: ' + JSON.stringify(E.info));
    o.push('scene: ' + JSON.stringify(E.scene));
    o.push('textures: ' + E.textures.n + ' live, ~' + E.textures.gpuMB + ' MB GPU (RGBA8 + mips estimate); by kind ' + JSON.stringify(E.textures.byKind));
  }
  o.push('network: ' + N.fetchedMedia + ' media URLs fetched (' + N.swMediaCached + ' in the SW cache, worker ' + N.sw + '; ' + N.resourceEntries + ' resource-timing entries of a ' + N.resourceBufferSize + ' buffer' +
    (N.resourceBufferMaybeFull ? ' - FULL: the fetched list is partial' : '') + ')' + (E.err ? '' : '; ' + N.texNotInScene + ' fetched textures carried by no live material (a CPU-packed array library counts here: splat, pavement)'));
  o.push(table(['family', 'on disk', 'MB', 'fetched', 'MB fetched', 'in scene', 'fetched, not in scene'], famRows));
  if (!E.err) {
    o.push(table(['owner (top-level)', 'meshes', 'materials', 'geometries', 'tris', 'instances'], E.byTop));
    o.push(table(['heaviest textures', 'kind', 'size', 'MB', 'owners'], E.textures.biggest));
  }
  console.log(o.join('\n'));
  const jf = out.replace(/\.json$/, '_census.json');
  fs.writeFileSync(jf, JSON.stringify({ page: E, families: famRows }, null, 1));
  console.log('\n-> ' + rel(jf));
}

// ---------------------------------------------------------------------------------------------
if (require.main === module) {
  if (flag('runtime')) runtime();
  else if (flag('page-snippet')) process.stdout.write(PAGE_SNIPPET + '\n');
  else {
    const C = staticCensus();
    console.log(report(C));
    const jf = opt('json', null);
    if (jf) { fs.writeFileSync(jf, JSON.stringify(C, (k, v) => (k === 'th' ? undefined : v), 1)); console.log('-> ' + jf); }
  }
}
module.exports = { staticCensus, imageInfo, roleOf, decodePass, MAT_RE, FLAT_STD, PAGE_SNIPPET };
