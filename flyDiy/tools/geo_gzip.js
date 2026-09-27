#!/usr/bin/env node
// geo_gzip.js — THE GEOMETRY TRANSPORT MIGRATION (G930, AS5a of
// futureDesigns/ASSETS-2026-09-27.md, §5.3 M10).
//
//   node tools/geo_gzip.js --report   # measure: raw vs gzip per family, write nothing
//   node tools/geo_gzip.js            # re-write every raw media/geo bin as ONE gzip stream
//
// Since G930 the bakers write the compressed form themselves (tools/_media_lib.js
// writeMedia and tools/media_lib.py write_media: anything under geo/ becomes
// `<stem>.<h8>.gz.bin`, gzip of the as-is bytes, h8 the hash of the AS-IS
// bytes). This tool brings the store baked BEFORE that into the same form
// without re-running a single baker - most of their sources live on the local
// box only - and is a no-op on a store already converted.
//
// WHAT IT DOES, per raw `media/geo/<fam>/<stem>.<h8>.bin`:
//   1. refuses unless sha256(file)[0:8] IS the name's h8 (the as-is bytes the
//      baker hashed, byte for byte - nothing here trusts a name it cannot check);
//   2. writes gzip(bytes) as `<stem>.<h8>.gz.bin` - the SAME h8, so the diff
//      shows every rename keeping its hash, which is the losslessness proof a
//      reviewer can read without running anything (GATE GEO re-proves it);
//   3. rewrites the old path to the new one in every manifest under src/
//      (the text of the path, nothing else - off/len index the as-is bytes and
//      do not move), then deletes the raw file.
// [[import-models-as-is]]: TRANSPORT only. The geometry is never decoded,
// quantised, reordered or re-encoded here; GATE GEO asserts the decoded bytes
// equal the as-is layout (nv/nt headers, the manifests' len) for every bin.
//
// THE PRICE, out loud (world_prep.js's warning, same store): running this
// writes the whole geometry store into git history a second time - ~77 MB of
// gzip blobs beside the ~103 MB of raw ones git keeps for ever. Run it once.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { mediaRel, gzipGeo, sha8, GZ_BIN } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const GEO = path.join(ROOT, 'media', 'geo');
const RAW = /^(.+)\.([0-9a-f]{8})\.bin$/;
const MiB = n => (n / 1048576).toFixed(2);

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// every text manifest under src/ that can name a geo bin (GATE MEDIA's list is
// a subset; a wider net costs nothing and misses nothing). Read and written as
// LATIN1, byte for byte: some baked headers carry a cp1252 dash, and a utf8
// round trip would turn it into U+FFFD. The paths themselves are ASCII.
function manifests() {
  return walk(path.join(ROOT, 'src'), []).filter(f => /\.(js|json)$/.test(f))
    .filter(f => fs.readFileSync(f, 'latin1').indexOf('media/geo/') >= 0);
}

function main(argv) {
  const report = argv.includes('--report');
  const files = walk(GEO, []).sort();
  const fam = {}, moves = [];
  let bad = 0;
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const sub = path.relative(path.join(ROOT, 'media'), path.dirname(abs)).split(path.sep).join('/');
    const F = fam[sub] || (fam[sub] = { n: 0, raw: 0, gz: 0, done: 0 });
    F.n++;
    if (GZ_BIN.test(rel)) {                    // already converted: count what it carries
      const buf = fs.readFileSync(abs);
      F.gz += buf.length; F.raw += zlib.gunzipSync(buf).length; F.done++;
      continue;
    }
    const m = path.basename(abs).match(RAW);
    if (!m) { console.log('  SKIP ' + rel + ' (not <stem>.<h8>.bin)'); bad++; continue; }
    const raw = fs.readFileSync(abs);
    if (sha8(raw) !== m[2]) { console.log('  REFUSE ' + rel + ': sha256 ' + sha8(raw) + ' is not the name\'s ' + m[2]); bad++; continue; }
    const gz = gzipGeo(raw), to = mediaRel(sub, m[1], 'bin', raw);
    F.raw += raw.length; F.gz += gz.length;
    moves.push({ rel, to, gz });
  }
  console.log('  family              bins      raw MiB   gzip MiB   ratio');
  let R = 0, G = 0, N = 0;
  for (const k of Object.keys(fam).sort()) {
    const F = fam[k]; R += F.raw; G += F.gz; N += F.n;
    console.log('  ' + k.padEnd(18) + String(F.n).padStart(6) + MiB(F.raw).padStart(12) + MiB(F.gz).padStart(11) + (F.gz / F.raw * 100).toFixed(1).padStart(7) + ' %' + (F.done ? '  (' + F.done + ' already gzip)' : ''));
  }
  console.log('  ' + 'media/geo'.padEnd(18) + String(N).padStart(6) + MiB(R).padStart(12) + MiB(G).padStart(11) + (G / R * 100).toFixed(1).padStart(7) + ' %');
  if (bad) { console.log('geo_gzip: ' + bad + ' file(s) refused - nothing written'); process.exit(1); }
  if (report) { console.log('geo_gzip: ' + moves.length + ' raw bin(s) to convert (--report: nothing written)'); return; }

  // write every gzip first, then the manifests, then delete: a crash midway
  // leaves both names on disk (GATE MEDIA says so), never a manifest naming
  // a file that is not there
  for (const mv of moves) fs.writeFileSync(path.join(ROOT, ...mv.to.split('/')), mv.gz);
  // the references: every gzip bin on disk answers for its raw name (the same
  // h8), so this step is idempotent and also finishes an interrupted run
  const map = new Map();
  for (const abs of walk(GEO, [])) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (GZ_BIN.test(rel)) map.set(rel.replace(GZ_BIN, '.bin'), rel);
  }
  const RE = /media\/geo\/[A-Za-z0-9_\-./]+?\.bin/g;
  let edited = 0, refs = 0;
  for (const f of manifests()) {
    const txt = fs.readFileSync(f, 'latin1');
    const out = txt.replace(RE, s => { const t = map.get(s); if (t) { refs++; return t; } return s; });
    if (out !== txt) { fs.writeFileSync(f, out, 'latin1'); edited++; }
  }
  for (const mv of moves) fs.unlinkSync(path.join(ROOT, ...mv.rel.split('/')));
  console.log('geo_gzip: ' + moves.length + ' bins re-written as gzip streams, ' + refs + ' references re-pointed in ' + edited + ' manifests');
}

if (require.main === module) main(process.argv.slice(2));
