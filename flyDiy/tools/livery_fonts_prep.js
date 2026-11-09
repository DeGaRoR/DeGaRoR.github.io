// LIVERY-TEXT (9 Nov): the livery's text faces into media/fonts, named by their content (<stem>.<h8>.woff2|woff, sw.js
// keeps media/ cache-first, so a name is never stale), each family's SIL Open Font Licence beside them, and the
// table aeroskin.js's AERO_TXT_FACES names its files from printed for the check.
//
// TWO KINDS OF FILE, AND THE LICENCE DECIDES WHICH:
//   - a family with NO Reserved Font Name (Barlow Condensed, Jost, Great Vibes): the CUT, from
//     flydiy-notes/evidence-2026-10-18/livery-text-2026-11-09/fonts-cut/subset_faces.py (fontTools 4.68: Basic Latin,
//     Latin-1, Latin Extended-A, the common punctuation; hinting dropped; kerning, ligatures and joins kept) - woff2.
//   - a family WITH one (Alfa Slab One: "Alfa Slab"; Lobster Two: "Lobster", "Lobster Two"; Stardos Stencil:
//     "Stardos", "Stardos Stencil"): a cut is a Modified Version, and OFL 3 forbids a Modified Version the reserved
//     name - so these ship WHOLE, the original file's bytes untouched, only wrapped as WOFF 1.0 here (each table zlib'd
//     on its own: a reader gives back the very sfnt; the OFL FAQ's own condition for a WOFF keeping its name). Bigger
//     (431 KB for the seven, against 126 KB cut) - but fetched only when a piece asks for that face and style.
// Both from github.com/google/fonts (the user's one allowed source, 9 Nov).
//
// usage: node tools/livery_fonts_prep.js <fonts-cut dir> <google fonts dir>   (writes media/fonts/, prints stem -> file)
//        node tools/livery_fonts_prep.js --check   (every file aeroskin names is there, its name its hash; a WHOLE one
//                                                  unwraps to its original's bytes when that original is given:
//                                                  --check <google fonts dir>)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'media', 'fonts');
const h8 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
// the families with a Reserved Font Name: stem -> the original file in the google/fonts tree
const WHOLE = {
  'alfa-slab-one-400': 'alfaslabone/AlfaSlabOne-Regular.ttf',
  'stardos-stencil-400': 'stardosstencil/StardosStencil-Regular.ttf',
  'stardos-stencil-700': 'stardosstencil/StardosStencil-Bold.ttf',
  'lobster-two-400': 'lobstertwo/LobsterTwo-Regular.ttf',
  'lobster-two-400-italic': 'lobstertwo/LobsterTwo-Italic.ttf',
  'lobster-two-700': 'lobstertwo/LobsterTwo-Bold.ttf',
  'lobster-two-700-italic': 'lobstertwo/LobsterTwo-BoldItalic.ttf',
};
// WOFF 1.0 (W3C, 2012): the sfnt's tables as they are, each deflated when that is smaller, the directory carrying each
// one's original length and checksum - nothing in the font is read, recomputed or rewritten
function woff1(sfnt) {
  const n = sfnt.readUInt16BE(4), flavor = sfnt.readUInt32BE(0), tabs = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + 16 * i;
    const t = { tag: sfnt.slice(o, o + 4), sum: sfnt.readUInt32BE(o + 4), off: sfnt.readUInt32BE(o + 8), len: sfnt.readUInt32BE(o + 12) };
    t.orig = sfnt.slice(t.off, t.off + t.len);
    const z = zlib.deflateSync(t.orig, { level: 9 });
    t.data = z.length < t.len ? z : t.orig;
    tabs.push(t);
  }
  const pad4 = x => (x + 3) & ~3;
  let total = 12 + 16 * n; for (const t of tabs) total += pad4(t.len);
  let off = 44 + 20 * n; for (const t of tabs) { t.woff = off; off += pad4(t.data.length); }
  const out = Buffer.alloc(off);
  out.write('wOFF', 0, 'latin1'); out.writeUInt32BE(flavor, 4); out.writeUInt32BE(off, 8); out.writeUInt16BE(n, 12);
  out.writeUInt16BE(0, 14); out.writeUInt32BE(total, 16); out.writeUInt16BE(1, 20); out.writeUInt16BE(0, 22);
  // (meta and private blocks: none - 24..43 stay zero)
  tabs.forEach((t, i) => {
    const o = 44 + 20 * i;
    t.tag.copy(out, o); out.writeUInt32BE(t.woff, o + 4); out.writeUInt32BE(t.data.length, o + 8);
    out.writeUInt32BE(t.len, o + 12); out.writeUInt32BE(t.sum, o + 16);
    t.data.copy(out, t.woff);
  });
  return out;
}
// ...and back: every table of the WOFF, inflated, against the original's own (the proof the bytes were not touched)
function woffSame(w, sfnt) {
  const n = w.readUInt16BE(12);
  if (n !== sfnt.readUInt16BE(4)) return false;
  for (let i = 0; i < n; i++) {
    const o = 44 + 20 * i, tag = w.slice(o, o + 4).toString('latin1');
    const at = w.readUInt32BE(o + 4), cl = w.readUInt32BE(o + 8), ol = w.readUInt32BE(o + 12);
    const d = w.slice(at, at + cl), t = cl < ol ? zlib.inflateSync(d) : d;
    let hit = null;
    for (let j = 0; j < n; j++) { const q = 12 + 16 * j; if (sfnt.slice(q, q + 4).toString('latin1') === tag) hit = sfnt.slice(sfnt.readUInt32BE(q + 8), sfnt.readUInt32BE(q + 8) + sfnt.readUInt32BE(q + 12)); }
    if (!hit || Buffer.compare(hit, t) !== 0) return false;
  }
  return true;
}
const arg = process.argv[2];
if (!arg) { console.error('usage: node tools/livery_fonts_prep.js <fonts-cut dir> <google fonts dir> | --check [<google fonts dir>]'); process.exit(2); }
if (arg === '--check') {
  const A = require(path.join(ROOT, 'src', 'viewer', 'aeroskin.js')), G = process.argv[3];
  let bad = 0, kb = 0;
  for (const f of A.AERO_TXT_FACES) for (const st of Object.keys(f.files || {})) {
    const p = path.join(ROOT, f.files[st]), ok = fs.existsSync(p);
    const m = ok && /\.([0-9a-f]{8})\.woff2?$/.exec(p), same = m && h8(fs.readFileSync(p)) === m[1];
    if (ok) kb += fs.statSync(p).size / 1024;
    let whole = true;
    const stem = path.basename(p).replace(/\.[0-9a-f]{8}\.woff2?$/, '');
    if (ok && WHOLE[stem] && !/\.woff$/.test(p)) whole = false;           // a reserved name must ship whole
    if (ok && WHOLE[stem] && G) whole = woffSame(fs.readFileSync(p), fs.readFileSync(path.join(G, WHOLE[stem])));
    if (!ok || !same || !whole) { bad++; console.log('BAD', f.key, st, f.files[st], !ok ? 'missing' : !same ? 'hash differs' : 'not the original, whole'); }
  }
  console.log((bad ? 'FAIL' : 'PASS') + ' media/fonts: ' + kb.toFixed(1) + ' KB');
  process.exit(bad ? 1 : 0);
}
const G = process.argv[3];
if (!G) { console.error('the google fonts dir is needed for the reserved-name families'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.woff2?$/.test(f)) fs.unlinkSync(path.join(OUT, f));   // (a re-cut replaces the set)
const map = {};
let kb = 0;
for (const f of fs.readdirSync(arg).sort()) {
  const src = path.join(arg, f);
  if (/^OFL-[a-z]+\.txt$/.test(f)) { fs.copyFileSync(src, path.join(OUT, f)); continue; }
  if (!/\.woff2$/.test(f)) continue;
  const stem = f.replace(/\.woff2$/, '');
  let buf, ext;
  if (WHOLE[stem]) {
    const orig = fs.readFileSync(path.join(G, WHOLE[stem]));
    buf = woff1(orig); ext = '.woff';
    if (!woffSame(buf, orig)) { console.error('the WOFF of ' + stem + ' does not give back its original'); process.exit(1); }
  } else {
    buf = fs.readFileSync(src); ext = '.woff2';
    if (buf.slice(0, 4).toString('latin1') !== 'wOF2') { console.error('not a woff2: ' + f); process.exit(1); }
  }
  const name = stem + '.' + h8(buf) + ext;
  fs.writeFileSync(path.join(OUT, name), buf);
  map[stem] = 'media/fonts/' + name; kb += buf.length / 1024;
}
console.log(JSON.stringify(map, null, 1));
console.log(Object.keys(map).length + ' files, ' + kb.toFixed(1) + ' KB');
