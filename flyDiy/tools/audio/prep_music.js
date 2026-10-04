// SND-ASSETS: the shipped music (SOUND-2026-10-04 §7.2-7.3, rulings s4 / s9; the catalogue schema is SND-MUSIC's G1673).
//
//   node tools/audio/prep_music.js [--selection tools/audio/music_selection_v1.json]
//
// For every item: decode the downloaded CC0 / CC-BY track (assets/audio/raw/music/, local), level it to -16 LUFS (a
// -1 dBFS peak ceiling), encode MP3 112 kb/s stereo, write media/audio/music/<artist>_<title>.<h8>.mp3 through
// _media_lib (owned dir, pruned), then write src/viewer/audio/music_catalogue.json (validated by music.js's own
// validate()) with a `station` per track (the radio), and regenerate CREDITS.md's music block (music_credits.js).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const ML = require(path.join(ROOT, 'tools', '_media_lib.js'));
const X = require(path.join(__dirname, 'excerpt.js'));
const MC = require(path.join(__dirname, 'music_credits.js'));
const M = require(path.join(ROOT, 'src', 'viewer', 'audio', 'music.js'));

const SUBDIR = 'audio/music';
const CAT = path.join(ROOT, 'src', 'viewer', 'audio', 'music_catalogue.json');

const clean = t => String(t).replace(/\.mp3\s*$/i, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
const word = s => String(s).normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 48);
const licenceOf = l => l === 'CC0-1.0' ? 'CC0' : /^CC-BY-(\d\.\d)$/.test(l || '') ? 'CC-BY ' + l.slice(6) : null;

(async () => {
  const argv = process.argv.slice(2);
  const si = argv.indexOf('--selection');
  const sel = JSON.parse(fs.readFileSync(si >= 0 ? argv[si + 1] : path.join(__dirname, 'music_selection_v1.json'), 'utf8'));
  const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'audio', 'music_ledger.json'), 'utf8'));
  const cat = [], emitted = [];
  for (const it of sel.items) {
    const t = L.tracks[it.id];
    if (!t || !t.raw) throw new Error(`#${it.id} is not downloaded - run fma_fetch.js --download --ids ${it.id}`);
    const lic = licenceOf(t.licence || t.albumLicence);
    if (!lic || !t.licenceCheck || t.licenceCheck === 'refused') throw new Error(`#${it.id}: licence ${t.licence} not accepted or not re-checked`);
    const { sr, ch } = await X.decode(path.join(ROOT, t.raw));
    const st = ch.length > 1 ? [ch[0], ch[1]] : [ch[0], ch[0]];
    let g = Math.pow(10, (-16 - X.loudness(st, sr)) / 20);
    const pk = X.peak(st) * g; if (pk > 0.89) g *= 0.89 / pk;
    const out = st.map(c => c.map(v => v * g));
    const mp3 = X.encodeMp3(out, sr, 112);
    const title = clean(t.title);
    const rel = ML.writeMedia(SUBDIR, word(t.artist) + '_' + word(title), 'mp3', mp3);
    emitted.push(rel);
    cat.push({
      id: 'fma' + it.id, file: rel, title, artist: t.artist, album: t.album || null, licence: lic, source: t.page,
      station: it.station, contexts: it.contexts, lufs: +X.loudness(out, sr).toFixed(1), durationS: +(out[0].length / sr).toFixed(1),
    });
    console.log('ok', it.station.padEnd(10), (mp3.length / 1048576).toFixed(2) + ' MB', t.artist, '-', title);
  }
  const bad = M.validate(cat);
  if (bad.length) throw new Error('catalogue invalid:\n  ' + bad.join('\n  '));
  const gone = ML.pruneMedia(SUBDIR, emitted);
  if (gone.length) console.log('pruned', gone.join(', '));
  fs.writeFileSync(CAT, JSON.stringify(cat, null, 1) + '\n');
  const cf = path.join(ROOT, 'CREDITS.md');
  fs.writeFileSync(cf, MC.withBlock(fs.readFileSync(cf, 'utf8'), MC.musicBlock(cat, M.creditLine)));
  const bytes = emitted.reduce((a, r) => a + fs.statSync(path.join(ROOT, r)).size, 0);
  console.log(cat.length, 'tracks,', (bytes / 1048576).toFixed(1), 'MB in media/audio/music; catalogue + CREDITS written');
})().catch(e => { console.error(e.message || e); process.exit(1); });
