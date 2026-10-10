#!/usr/bin/env node
// _geo_check.js — GATE GEO (G930, AS5a): every geometry bin under media/geo/
// travels as ONE gzip stream, and what it decodes to IS the as-is layout.
//
//   node tools/_geo_check.js     (the negative selftest runs every time - it is
//                                 synthetic and costs microseconds)
//
// WHY. GitHub Pages sends a .bin raw (application/octet-stream is not in its
// compressed types), so since G930 the bakers write every mesh bin as gzip
// (tools/_media_lib.js writeMedia / media_lib.py write_media) and the page
// gunzips it in ASSET_FETCH (src/viewer/assets.js). [[import-models-as-is]]
// allows TRANSPORT compression only: this gate is what makes "lossless" a
// verdict instead of a claim. Every file is decoded, and:
//
//   NAME      it is `<stem>.<h8>.gz.bin` - the suffix is what assets.js and
//             readGeo decide on, so a raw body under a gzip name (or the
//             reverse) would reach a codec undecoded;
//   ONE       it is one gzip stream: magic 1f 8b 08, and the trailer's CRC32
//   STREAM    and ISIZE describe the WHOLE decoded file (a second member
//             would be decoded by node yet is a format this store never
//             writes - world_prep.js's rule, the same store);
//   AS-IS     sha256(decoded)[0:8] is the name's h8: the name is the hash of
//             the bytes the BAKER encoded, so equality here is byte equality
//             with the as-is bin, file by file;
//   LAYOUT    every manifest record that names the bin agrees with the
//             decoded bytes: each part's u32 nv/nt header equals the
//             manifest's counts where it carries them, each len equals the
//             codec's layout for those counts (50/51/52/53/55_*_codec.js),
//             every slice lies inside the file, and for the quantised
//             families the parts tile the file with no byte unclaimed;
//   COVERED   every file under media/geo is named by a record this gate
//             parsed - no bin escapes the layout check.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { sha8 } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const fail = [];

// CRC-32 (IEEE), table-driven: zlib.crc32 is node >= 22.2 and the gate must
// not depend on which node the box carries
const CRC_T = (() => { const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// ---------------------------------------------------------------------------
// THE TRANSPORT of one file -> the decoded as-is bytes, or null (and a failure)
// ---------------------------------------------------------------------------
const NAME = /^media\/geo\/.+\/[^/]+\.([0-9a-f]{8})\.gz\.bin$/;
function openGeo(rel, buf, bad) {
  const m = rel.match(NAME);
  if (!m) { bad(rel + ': not named <stem>.<h8>.gz.bin - the page and readGeo decide the transport by that suffix'); return null; }
  if (!(buf.length > 18 && buf[0] === 0x1F && buf[1] === 0x8B && buf[2] === 8)) { bad(rel + ': not a gzip stream (a raw body under a gzip name reaches the codec undecoded)'); return null; }
  let out;
  try { out = zlib.gunzipSync(buf); } catch (e) { bad(rel + ': does not gunzip - ' + e.message); return null; }
  if (buf.readUInt32LE(buf.length - 4) !== (out.length >>> 0) || buf.readUInt32LE(buf.length - 8) !== crc32(out)) {
    bad(rel + ': more than one gzip stream (the trailer does not describe the whole file)'); return null; }
  const h = sha8(out);
  if (h !== m[1]) { bad(rel + ': decodes to bytes hashing ' + h + ', the name says ' + m[1] + ' - not the as-is bytes the baker wrote'); return null; }
  return out;
}

// ---------------------------------------------------------------------------
// THE LAYOUTS, one per codec: what the header at a slice says, and the byte
// count the codec reads for it. `rec` is the manifest's own record of the slice.
// ---------------------------------------------------------------------------
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const LAYOUT = {
  // 51_prop_codec.js: u32 nv, nt | i16 pos[3n] | i8 nrm[3n] | u16 uv[2n] | u16 idx[3t]
  prop: (b, o) => { const nv = u32(b, o), nt = u32(b, o + 4); return { nv, nt, len: 8 + 13 * nv + 6 * nt }; },
  // 50_model_codec.js: u32 nv, nt | i16 pos[3n] | u16 uv[2n] | u16 idx[3t] | [u8 sid[n]]
  model: (b, o, rec) => { const nv = u32(b, o), nt = u32(b, o + 4); return { nv, nt, len: 8 + 10 * nv + 6 * nt + (rec.sid ? nv : 0) }; },
  // 53_tree_codec.js: u32 nv, nt, wide | i16 pos[3n] | i8 nrm[3n] | u16 uv[2n] | u8 ao[n] | u16|u32 idx[3t]
  tree: (b, o) => { const nv = u32(b, o), nt = u32(b, o + 4), w = u32(b, o + 8) === 1; return { nv, nt, len: 12 + 14 * nv + 3 * nt * (w ? 4 : 2) }; },
};

// one quantised slice: header counts against the manifest's, len against the layout
function checkSlice(bad, where, kind, dec, rec) {
  if (!(rec.off >= 0 && rec.len > 0 && rec.off + rec.len <= dec.length)) { bad(where + ': slice ' + rec.off + '+' + rec.len + ' is outside the ' + dec.length + '-byte file'); return false; }
  const h = LAYOUT[kind](dec, rec.off, rec);
  if (rec.nv !== undefined && h.nv !== rec.nv) bad(where + ': header nv ' + h.nv + ', manifest ' + rec.nv);
  if (rec.nt !== undefined && h.nt !== rec.nt) bad(where + ': header nt ' + h.nt + ', manifest ' + rec.nt);
  if (h.len !== rec.len) bad(where + ': len ' + rec.len + ' in the manifest, the layout of nv ' + h.nv + ' nt ' + h.nt + ' is ' + h.len + ' bytes');
  return true;
}

// the quantised families pack their parts back to back: the distinct slices
// (trees share a slice between rungs) must tile [0, length) exactly
function checkTiles(bad, where, dec, slices) {
  const seen = new Map();
  for (const s of slices) seen.set(s.off + ':' + s.len, s);
  const u = [...seen.values()].sort((a, b) => a.off - b.off);
  let at = 0;
  for (const s of u) {
    if (s.off !== at) { bad(where + ': ' + (s.off > at ? (s.off - at) + ' bytes at ' + at + ' belong to no part' : 'parts overlap at ' + s.off)); return; }
    at = s.off + s.len;
  }
  if (at !== dec.length) bad(where + ': the parts end at ' + at + ', the file at ' + dec.length);
}

// the float32 skinned families (52_char_codec.js, 55_animal_codec.js): sections
// 4-aligned, ibm f32[16 nJ] first, then per mesh pos, nrm, uv [jt u8[4n], wt
// f32[4n]], idx u16[3t] - the manifest carries every offset and count
function checkSkinned(bad, where, dec, rec, skinOf) {
  const ibm = 64 * rec.joints.length;
  let first = dec.length;
  for (const m of rec.meshes) {
    const need = 32 * m.nv + (skinOf(m) ? 20 * m.nv : 0) + 6 * m.nt;
    first = Math.min(first, m.off);
    if (m.off % 4) bad(where + ' mesh ' + m.name + ': off ' + m.off + ' is not 4-aligned (the codec views f32 there)');
    if (!(m.off >= 0 && m.off + m.len <= dec.length)) bad(where + ' mesh ' + m.name + ': slice ' + m.off + '+' + m.len + ' is outside the ' + dec.length + '-byte file');
    if (need > m.len || m.len - need > 3) bad(where + ' mesh ' + m.name + ': len ' + m.len + ', the layout of nv ' + m.nv + ' nt ' + m.nt + ' is ' + need + ' (+ at most 3 bytes of alignment)');
  }
  if (ibm > first) bad(where + ': the ' + rec.joints.length + ' inverse bind matrices (' + ibm + ' bytes) run into the first mesh at ' + first);
}

// ---------------------------------------------------------------------------
// THE MANIFESTS, evaluated with stub registrars (no THREE, no page)
// ---------------------------------------------------------------------------
function loadManifests() {
  const recs = [];            // { kind, key, bin, rec }
  const run = (file) => {
    const got = [];
    const ctx = { registerPropPack: p => got.push(['pack', p]), registerChar: c => got.push(['char', c]), registerCharAnim: a => got.push(['anim', a]),
      registerAnimal: a => got.push(['animal', a]), registerAnimalClips: () => {}, module: { exports: {} }, console: { log() {}, warn() {} }, window: {} };
    ctx.exports = ctx.module.exports; ctx.globalThis = ctx;
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    for (const v of Object.values(ctx.module.exports)) if (v && v.groups && v.bin) got.push(['model', v]);
    const src = path.relative(ROOT, file).split(path.sep).join('/');
    for (const [kind, p] of got) {
      if (kind === 'pack') { for (const k of p.order || Object.keys(p.props || {})) { const q = p.props[k]; if (q && q.bin) recs.push({ kind: 'prop', key: k, bin: q.bin, rec: q, src }); } }
      else if (kind === 'animal') { recs.push({ kind, key: p.key, bin: p.bin, rec: p, src }); recs.push({ kind: 'clips', key: p.key, bin: p.clipBin, rec: p, src }); }
      else recs.push({ kind, key: p.key || path.basename(file, '.js'), bin: p.bin, rec: p, src });
    }
  };
  const list = (dir, json) => { const f = path.join(ROOT, 'src', dir, json); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map(x => path.join(ROOT, 'src', dir, x)) : []; };
  const glob = (dir, re) => { const d = path.join(ROOT, 'src', dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f)) : []; };
  for (const f of [].concat(list('props', 'props_packs.json'), list('pier', 'pier_packs.json'), list('totems', 'totems_packs.json'),
                            list('cabin', 'cabin_packs.json'), list('loads', 'loads_packs.json'), list('panelhw', 'panelhw_packs.json'), list('animals', 'animals_packs.json'),
                            glob('models', /_model\.js$/), glob('chars', /_(?:char|anim)\.js$/), glob('animals', /_animal\.js$/))) run(f);
  const T = path.join(ROOT, 'src', 'core', 'trees_pack.json');
  if (fs.existsSync(T)) for (const c of JSON.parse(fs.readFileSync(T, 'utf8')).collections || []) if (c.bin) recs.push({ kind: 'tree', key: c.name, bin: c.bin, rec: c, src: 'src/core/trees_pack.json' });
  return recs;
}

// one record against its decoded file
function checkRecord(bad, r, dec) {
  const w = r.src + ' ' + r.key;
  if (r.kind === 'prop') {
    for (const [i, p] of r.rec.parts.entries()) checkSlice(bad, w + ' part ' + i, 'prop', dec, p);
    checkTiles(bad, w, dec, r.rec.parts);
  } else if (r.kind === 'model') {
    for (const [g, p] of Object.entries(r.rec.groups)) checkSlice(bad, w + ' group ' + g, 'model', dec, p);
    checkTiles(bad, w, dec, Object.values(r.rec.groups));
  } else if (r.kind === 'tree') {
    if (r.rec.bytes !== dec.length) bad(w + ': the pack says ' + r.rec.bytes + ' bytes, the decoded bin is ' + dec.length);
    const all = [];
    for (const s of r.rec.subjects || []) for (const set of ['rungs', 'stand', 'snag']) for (const rung of s[set] || [])
      for (const [i, p] of (rung.parts || []).entries()) { if (checkSlice(bad, w + ' ' + s.name + ' ' + set + ' lod' + rung.lod + ' part ' + i, 'tree', dec, p)) all.push(p); }
    checkTiles(bad, w, dec, all);
  } else if (r.kind === 'char') {
    checkSkinned(bad, w, dec, r.rec, () => true);
  } else if (r.kind === 'animal') {
    checkSkinned(bad, w, dec, r.rec, m => !!m.skin);
  } else if (r.kind === 'anim') {
    const need = 16 * r.rec.frames * r.rec.joints.length;
    if (r.rec.len !== undefined && r.rec.len !== dec.length) bad(w + ': the manifest says ' + r.rec.len + ' bytes, the decoded bin is ' + dec.length);
    if (need !== dec.length) bad(w + ': ' + r.rec.frames + ' frames x ' + r.rec.joints.length + ' joints x f32[4] is ' + need + ' bytes, the decoded bin is ' + dec.length);
  } else if (r.kind === 'clips') {
    for (const c of r.rec.clips || []) {
      const stride = 3 * c.nt.length + 4 * c.nr.length + 3 * c.ns.length, need = 12 * c.frames + 4 * stride * c.frames;
      if (c.off % 4 || !(c.off >= 0 && c.off + c.len <= dec.length) || need > c.len || c.len - need > 3)
        bad(w + ' clip ' + (c.key || c.name) + ': slice ' + c.off + '+' + c.len + ' in a ' + dec.length + '-byte file, the layout needs ' + need + ' 4-aligned');
    }
  }
}

// ---------------------------------------------------------------------------
// THE STORE
// ---------------------------------------------------------------------------
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p).split(path.sep).join('/')); }
  return out;
}

function runStore() {
  const bad = m => fail.push(m);
  const files = walk(path.join(ROOT, 'media', 'geo'), []).sort();
  const dec = new Map();
  let wire = 0, raw = 0;
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(ROOT, ...rel.split('/')));
    wire += buf.length;
    const d = openGeo(rel, buf, bad);
    if (d) { dec.set(rel, d); raw += d.length; }
  }
  const recs = loadManifests(), named = new Set();
  let slices = 0;
  for (const r of recs) {
    const rel = String(r.bin).replace(/^.*?(media\/geo\/)/, '$1');
    named.add(rel);
    if (!files.includes(rel)) { bad(r.src + ' ' + r.key + ': names ' + rel + ', which is not on disk'); continue; }
    const d = dec.get(rel);
    if (!d) continue;                       // its transport already failed above
    checkRecord(bad, r, d);
    slices++;
  }
  for (const rel of files) if (!named.has(rel)) bad(rel + ': named by no manifest this gate parses - its layout is unchecked');
  // the viewer's copy of the tree manifest names the same bins as the core's
  const tv = path.join(ROOT, 'src', 'viewer', 'trees_pack.js');
  if (fs.existsSync(tv)) {
    const core = new Set(recs.filter(r => r.kind === 'tree').map(r => r.bin));
    for (const m of fs.readFileSync(tv, 'utf8').match(/media\/geo\/trees\/[A-Za-z0-9_\-.]+?\.bin/g) || [])
      if (!core.has(m)) bad('src/viewer/trees_pack.js names ' + m + ', which src/core/trees_pack.json does not');
  }
  return { files: files.length, decoded: dec.size, recs: recs.length, slices, wire, raw };
}

// ---------------------------------------------------------------------------
// THE SELFTEST: every rule broken on purpose, on synthetic bytes
// ---------------------------------------------------------------------------
function selftest() {
  // one prop part: 3 vertices, 1 triangle = 8 + 39 + 6 = 53 bytes
  const part = (nv, nt) => { const b = Buffer.alloc(8 + 13 * nv + 6 * nt); b.writeUInt32LE(nv, 0); b.writeUInt32LE(nt, 4); for (let i = 8; i < b.length; i++) b[i] = (i * 37) & 255; return b; };
  const A = part(3, 1), Bp = part(4, 2), asIs = Buffer.concat([A, Bp]);
  const gz = b => zlib.gzipSync(b, { level: 9 });
  const name = (b, ext) => 'media/geo/props/synthetic.' + sha8(b) + (ext || '.gz.bin');
  const rec = (over) => Object.assign({ kind: 'prop', key: 'synthetic', src: 'selftest', rec: { parts: [{ nv: 3, nt: 1, off: 0, len: A.length }, { nv: 4, nt: 2, off: A.length, len: Bp.length }] } }, over || {});
  const caught = (fn) => { const got = []; fn(m => got.push(m)); return got.length > 0; };
  const clean = (fn) => { const got = []; fn(m => got.push(m)); return got.length === 0; };
  const cases = [
    ['a clean synthetic bin passes (no false positive)', () => clean(bad => { const d = openGeo(name(asIs), gz(asIs), bad); if (d) checkRecord(bad, rec(), d); })],
    ['a raw body under a .gz.bin name', () => caught(bad => openGeo(name(asIs), asIs, bad))],
    ['a gzip body under a plain .bin name', () => caught(bad => openGeo(name(asIs, '.bin'), gz(asIs), bad))],
    ['two gzip streams in one file', () => caught(bad => openGeo(name(asIs), Buffer.concat([gz(A), gz(Bp)]), bad))],
    ['decoded bytes that are not the as-is bytes', () => { const x = Buffer.from(asIs); x[20] ^= 1; return caught(bad => openGeo(name(asIs), gz(x), bad)); }],
    ['a part header nv the manifest does not carry', () => caught(bad => { const r = rec(); r.rec.parts[1].nv = 5; checkRecord(bad, r, asIs); })],
    ['a manifest len the layout disagrees with', () => caught(bad => { const r = rec(); r.rec.parts[0].len += 1; r.rec.parts[1].off += 1; checkRecord(bad, r, Buffer.concat([asIs, Buffer.alloc(1)])); })],
    ['bytes no part claims', () => caught(bad => checkRecord(bad, rec(), Buffer.concat([asIs, Buffer.alloc(4)])))],
    ['a slice outside the file', () => caught(bad => { const r = rec(); r.rec.parts[1].off = 1000; checkRecord(bad, r, asIs); })],
  ];
  let missed = 0;
  for (const [what, run] of cases) {
    let ok = false;
    try { ok = !!run(); } catch (e) { ok = false; }
    console.log('  selftest ' + (ok ? 'caught  ' : 'MISSED  ') + what);
    if (!ok) missed++;
  }
  if (missed) fail.push(missed + ' selftest case(s) not caught - those rules are inert');
}

// ---------------------------------------------------------------------------
if (require.main === module) {
  console.log('=== GEO ===');
  selftest();
  const S = runStore();
  const MiB = n => (n / 1048576).toFixed(2);
  console.log('  media/geo: ' + S.files + ' bins, ' + S.decoded + ' decoded; ' + S.recs + ' manifest records, ' + S.slices + ' layout-checked');
  console.log('  wire ' + MiB(S.wire) + ' MiB (one gzip stream each) -> as-is ' + MiB(S.raw) + ' MiB decoded' + (S.raw ? ' (' + (100 * S.wire / S.raw).toFixed(1) + ' %)' : ''));
  if (fail.length) {
    for (const f of fail.slice(0, 40)) console.log('  FAIL ' + f);
    if (fail.length > 40) console.log('  ... and ' + (fail.length - 40) + ' more');
    console.log('GATE GEO: FAIL');
    process.exit(1);
  }
  console.log('GATE GEO: PASS');
}

module.exports = { openGeo, checkRecord, loadManifests, LAYOUT };
