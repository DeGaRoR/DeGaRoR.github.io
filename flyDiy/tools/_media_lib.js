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
//
// Paths returned are PAGE-RELATIVE ('media/...'): index.html and dev.html
// both live at flyDiy/, and any page elsewhere (the tools/ benches) sets
// window.FLYDIY_ASSET_BASE — see BASE_DECL below, which every generated
// payload embeds so the prefix is resolved at its own eval.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');

// writeMedia('tex/wood', 'maple_aero_512', 'jpg', buf)
//   -> 'media/tex/wood/maple_aero_512.<h8>.jpg'  (page-relative, forward /)
function writeMedia(subdir, stem, ext, buf) {
  const h8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const rel = `media/${subdir}/${stem}.${h8}.${ext}`;
  const abs = path.join(ROOT, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // content-addressed: an existing file with this name IS these bytes
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
  return rel;
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

module.exports = { writeMedia, pruneMedia, BASE_DECL, MEDIA };
