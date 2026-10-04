// SND-ASSETS: cut a "full album" single file into its tracks at the silences (Daniel William Lawrence's CC0 blues
// albums ship as one file each).
//   node tools/audio/split_album.js --id 273704 [--gap 1.2] [--floor -48]
// Writes assets/audio/raw/music/<id>p<n>.mp3 (local) and a ledger row per part: id '<id>p<n>', the album's page,
// licence and check carried over, `partOf` the album id, `startS` in the album.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const X = require(path.join(__dirname, 'excerpt.js'));
const LEDGER = path.join(ROOT, 'assets', 'audio', 'music_ledger.json');

(async () => {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const id = opt('--id'), gapS = +opt('--gap', 1.2), floor = +opt('--floor', -48);
  const L = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const t = L.tracks[id];
  if (!t || !t.raw) throw new Error('album ' + id + ' not downloaded');
  const { sr, ch } = await X.decode(path.join(ROOT, t.raw));
  const mono = ch.length > 1 ? ch[0].map((v, i) => 0.5 * (v + ch[1][i])) : ch[0];
  const fr = Math.floor(0.1 * sr), db = [];
  for (let i = 0; i + fr <= mono.length; i += fr) { let s = 0; for (let j = i; j < i + fr; j++) s += mono[j] * mono[j]; db.push(10 * Math.log10(s / fr + 1e-12)); }
  // silences: runs of frames under the floor at least gapS long; cut in their middle
  const cuts = [0];
  for (let i = 0; i < db.length;) {
    if (db[i] < floor) { let j = i; while (j < db.length && db[j] < floor) j++; if ((j - i) * 0.1 >= gapS && i > 0 && j < db.length) cuts.push(Math.floor((i + j) / 2) * fr); i = j; }
    else i++;
  }
  cuts.push(mono.length);
  let n = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], dur = (b - a) / sr;
    if (dur < 60) continue;   // a fragment, not a track
    n++;
    const part = ch.map(c => c.slice(a, b));
    const pid = id + 'p' + n, file = path.join(ROOT, 'assets', 'audio', 'raw', 'music', pid + '.mp3');
    fs.writeFileSync(file, X.encodeMp3(part.slice(0, 2), sr, 160));
    L.tracks[pid] = Object.assign({}, t, { id: pid, title: t.album.replace(/\s*\(.*$/, '') + ' — part ' + n, partOf: id,
      startS: +(a / sr).toFixed(1), durationS: +dur.toFixed(1), raw: path.relative(ROOT, file).replace(/\\/g, '/'), file: undefined });
    console.log(pid, (a / sr / 60).toFixed(1) + ' min', dur.toFixed(0) + ' s');
  }
  fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1) + '\n');
  console.log(n, 'parts');
})().catch(e => { console.error(e.message || e); process.exit(1); });
