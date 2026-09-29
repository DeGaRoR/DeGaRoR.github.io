// _media_lib.js — the ONE way a baker writes an external media file.
//
// Since 2026-09-01 the artifact is multi-file and textures live as REAL
// binary files under flyDiy/media/, referenced by URL from the slim baked
// manifests — no base64 anywhere. Three rules, enforced here so every baker
// obeys them by construction:
//
//   BYTE-EXACT   the buffer written is the buffer the baker encoded — this
//                helper never re-encodes ([[import-models-as-is]]: textures
//                are re-encoded only where a pipeline declares a budget, and
//                that decision stays in the baker, not in the writer).
//   SELF-BUSTING an 8-hex content hash rides IN THE FILENAME, so a changed
//                texture is a new URL (no ?v= needed on media), an unchanged
//                one is a byte-identical file, and git sees exactly what
//                changed. GitHub Pages' 10-minute cache can never go stale.
//   OWNED DIRS   each baker owns its own media/ subdirectory and prunes it
//                after a full bake: a file this run did not emit is deleted,
//                so orphans cannot accumulate and GATE MEDIA can hold
//                referenced == present as an equality.
//   ONE COPY     (G901, the asset census's P2) bytes already in the subdir
//                under ANOTHER stem are returned, not written twice: the
//                census found 32 byte-identical groups (5.8 MiB), the same
//                map shipped under two or three names (ashbark = hollybark =
//                raspberrybark). The existing file is the one returned, so
//                it is in the baker's emitted list and its prune keeps it
//                for as long as the bake still asks for those bytes.
//
// Paths returned are PAGE-RELATIVE ('media/...'): index.html and dev.html
// both live at flyDiy/, and any page elsewhere (the tools/ benches) sets
// window.FLYDIY_ASSET_BASE — see BASE_DECL below, which every generated
// payload embeds so the prefix is resolved at its own eval.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');

// GEOMETRY TRAVELS AS ONE GZIP STREAM (G930, AS5a). GitHub Pages compresses
// text types only and serves a .bin raw, so every file under media/geo/ is
// written as exactly one gzip stream (the world pack's pattern, world_prep.js)
// and named `<stem>.<h8>.gz.bin`, where h8 is still the hash of the AS-IS
// bytes the baker encoded - not of the gzip. Three reasons, in order:
//   - the decoded bytes are provably the as-is bytes: GATE GEO gunzips every
//     file and re-hashes it against its own name ([[import-models-as-is]]:
//     transport compression only, the geometry is never re-encoded);
//   - a re-bake of unchanged geometry writes nothing, whatever zlib the
//     machine has (Python's system zlib and node's bundled one do not emit
//     the same deflate bytes; hashing the gzip would churn git on every
//     re-bake from another box);
//   - the NAME changes with the transport (`.gz.bin`), so sw.js's permanent
//     cache-first /media/ store can never hand a raw pre-G930 body to a page
//     that gunzips.
// Consumers: ASSET_FETCH (src/viewer/assets.js) gunzips by that suffix in the
// page; node reads through readGeo below. Nothing else changes: the manifests'
// off/len still index the as-is bytes.
const isGeo = subdir => subdir === 'geo' || subdir.startsWith('geo/');
const GZ_BIN = /\.gz\.bin$/;
const sha8 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);

// THE COOKED TEXTURE LAYERS TRAVEL THE SAME WAY (G910, AS2): a baker that asks for ext 'gz.bin' in any
// subdirectory gets geometry's rule - the file is one gzip stream, the name's hash is the AS-IS bytes' (the
// raw RGBA layers tools/array_cook.js packs), ASSET_FETCH gunzips it by the suffix, readGeo reads it in node.
// the name a buffer gets, without writing it (report runs, the migration)
function mediaRel(subdir, stem, ext, buf) {
  if (isGeo(subdir) && ext === 'bin') ext = 'gz.bin';
  return `media/${subdir}/${stem}.${sha8(buf)}.${ext}`;
}

// writeMedia('tex/wood', 'maple_aero_512', 'jpg', buf)
//   -> 'media/tex/wood/maple_aero_512.<h8>.jpg'  (page-relative, forward /)
// writeMedia('geo/props', 'bandsaw', 'bin', asIs)
//   -> 'media/geo/props/bandsaw.<h8 of asIs>.gz.bin'  (the file: gzip(asIs))
function writeMedia(subdir, stem, ext, buf) {
  const rel = mediaRel(subdir, stem, ext, buf);
  // G901 (AS0a): a non-geometry file whose exact bytes already sit in this directory under another stem is
  // reused (the fold); a geometry .gz.bin is named by its as-is bytes' hash already (G930), so it needs none
  if (!GZ_BIN.test(rel)) { const same = sameBytes(subdir, sha8(buf), ext, buf); if (same) return `media/${subdir}/${same}`; }
  const abs = path.join(ROOT, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // content-addressed: an existing file with this name IS these bytes
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, GZ_BIN.test(rel) ? gzipGeo(buf) : buf);
  return rel;
}

// the file already in media/<subdir> (that directory only, not below it) that
// holds exactly these bytes, whatever its stem, or null. Only names ending in
// .<h8>.<ext> can (writeMedia put the hash there), and each candidate is
// compared byte for byte, so an 8-hex collision cannot alias two maps. The
// first name in sort order wins, so the choice never depends on which alias a
// bake happens to write first: the fold is the same on every run, and the
// prune then removes the other copies.
function sameBytes(subdir, h8, ext, buf) {
  const dir = path.join(MEDIA, ...subdir.split('/'));
  if (!fs.existsSync(dir)) return null;
  const tail = `.${h8}.${ext}`;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(tail)).sort()) {
    const p = path.join(dir, f), st = fs.statSync(p);
    if (st.isFile() && st.size === buf.length && fs.readFileSync(p).equals(buf)) return f;
  }
  return null;
}

function gzipGeo(buf) { return zlib.gzipSync(buf, { level: 9 }); }

// readGeo(relOrAbs) -> Uint8Array of the AS-IS bytes, the node twin of
// ASSET_FETCH: a `.gz.bin` is gunzipped, anything else (a bench stage the
// LOD tools read, a synthetic fixture) is returned as read. Always a fresh
// buffer at byteOffset 0, so the float32 codecs view it without a copy.
function readGeo(file) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, ...file.split('/'));
  const raw = fs.readFileSync(abs);
  return new Uint8Array(GZ_BIN.test(abs) ? zlib.gunzipSync(raw) : raw);
}

// pruneMedia('tex/wood', [rel, rel, ...]) — delete everything in the owned
// subdirectory that this bake did not emit. Returns the basenames removed so
// the baker can say so out loud. Never called on a partial/--report run —
// that discipline stays with the caller, which knows what kind of run it is.
function pruneMedia(subdir, keepRels) {
  const dir = path.join(MEDIA, ...subdir.split('/'));
  if (!fs.existsSync(dir)) return [];
  const keep = new Set(keepRels.map(r => r.split('/').pop()));
  const gone = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isFile() && !keep.has(f)) { fs.unlinkSync(p); gone.push(f); }
  }
  return gone;
}

// The prefix idiom every generated payload embeds, VERBATIM, inside its own
// scope (an IIFE or arrow argument — never top-level, where two classic
// <script>s would collide on the binding). Pages at flyDiy/ set nothing and
// get ''; tools/ bench pages set window.FLYDIY_ASSET_BASE = '../'.
const BASE_DECL =
  "const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';";

// THE TEXTURE PREP (LOADING S4): the python encoder behind media_lib.py's
// encode_tex, for the node bakers - a role picks the format (color -> JPEG,
// or WebP with alpha; normal -> WebP q92; data -> WebP, one channel when
// grey; keep -> byte-exact), a size cap resamples. Returns { data, ext }.
// A FLAT map (G903: every channel's std under 2 at 256 px, the census's
// FLAT_STD) returns { data: null, ext: 'flat', flat: [r, g, b] } and writes no
// file: the baker records the triple where the path went (media_lib.py says why).
function encodeTex(buf, role, maxPx) {
  const os = require('os'), cp = require('child_process');
  const tmp = path.join(os.tmpdir(), 'flydiy_tex_' + process.pid + '_' + Math.random().toString(16).slice(2));
  fs.writeFileSync(tmp + '.in', buf);
  const r = cp.spawnSync('python', [path.join(__dirname, 'media_lib.py'), 'encode', role, String(maxPx || 2048), tmp + '.in', tmp + '.out'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('encodeTex: ' + (r.stderr || r.stdout));
  const out = r.stdout.trim();
  if (out.startsWith('flat ')) {
    try { fs.unlinkSync(tmp + '.in'); } catch (e) {}
    return { data: null, ext: 'flat', flat: out.slice(5).split(',').map(Number) };
  }
  const data = fs.readFileSync(tmp + '.out'), ext = out;
  try { fs.unlinkSync(tmp + '.in'); fs.unlinkSync(tmp + '.out'); } catch (e) {}
  return { data, ext };
}
// THE CANVAS-EXACT DECODE (G910): images -> raw RGBA8 as a browser's 2D canvas reads them back
// (media_lib.py decode_rgba says why that is byte-exact for the ground's maps). One python process for the
// whole list. -> [{ w, h, data: Buffer }] in the order asked
function decodeRGBA(files) {
  const os = require('os'), cp = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy_rgba_'));
  const outs = files.map((f, i) => path.join(tmp, i + '.rgba'));
  fs.writeFileSync(path.join(tmp, 'list'), files.map((f, i) => f + '\t' + outs[i]).join('\n'));
  let r = null;
  for (const py of ['python', 'python3', 'py']) {
    r = cp.spawnSync(py, [path.join(__dirname, 'media_lib.py'), 'rgba', path.join(tmp, 'list')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    if (!r.error) break;
  }
  if (!r || r.error || r.status !== 0) throw new Error('decodeRGBA: ' + (r && (r.error ? r.error.message : r.stderr || r.stdout)));
  const dims = r.stdout.trim().split(/\r?\n/).map(l => l.trim().split(/\s+/).map(Number));
  const res = outs.map((o, i) => ({ w: dims[i][0], h: dims[i][1], data: fs.readFileSync(o) }));
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}
// flatConst(buf) -> [r, g, b] for a flat map, or null - the same test, for the node
// bakers that write their maps byte-exact without encodeTex (G903).
function flatConst(buf) {
  const os = require('os'), cp = require('child_process');
  const tmp = path.join(os.tmpdir(), 'flydiy_flat_' + process.pid + '_' + Math.random().toString(16).slice(2));
  fs.writeFileSync(tmp, buf);
  const r = cp.spawnSync('python', [path.join(__dirname, 'media_lib.py'), 'flat', tmp], { encoding: 'utf8' });
  try { fs.unlinkSync(tmp); } catch (e) {}
  if (r.status !== 0) throw new Error('flatConst: ' + (r.stderr || r.stdout));
  const c = r.stdout.trim().split(' ')[0];
  return c === '-' ? null : c.split(',').map(Number);
}
// writeMap(subdir, stem, ext, buf) - a baker's byte-exact map write, or its
// constant: [r, g, b] for a flat map (nothing written), else writeMedia's path.
// The emitter writes `k: [r, g, b]` where it wrote a getter; the consumer binds
// TEX_FLAT (src/viewer/assets.js).
function writeMap(subdir, stem, ext, buf) {
  return flatConst(buf) || writeMedia(subdir, stem, ext, buf);
}
// assetSrc(...parts) - a bake SOURCE under assets/: this checkout's own when it
// has it, else FLYDIY_ASSETS, else the main checkout's (the sources are gitignored
// and a worktree has none; never junction them in - a worktree removal empties
// the link's target). pavement_tex_prep.js's ROOTS, for every node baker (G903).
const MAIN_ASSETS = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets';
function assetSrc(...parts) {
  const roots = [path.join(__dirname, '..', 'assets'), process.env.FLYDIY_ASSETS, MAIN_ASSETS].filter(Boolean);
  for (const r of roots) { const f = path.join(r, ...parts); if (fs.existsSync(f)) return f; }
  return path.join(roots[0], ...parts);
}
module.exports = { decodeRGBA, writeMedia, pruneMedia, BASE_DECL, MEDIA, encodeTex, flatConst, writeMap, assetSrc, mediaRel, readGeo, gzipGeo, isGeo, GZ_BIN, sha8 };
