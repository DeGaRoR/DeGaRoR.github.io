#!/usr/bin/env node
// THE MUSIC PLAYER'S TEST TRACKS (SND-MUSIC G1673) - for GATE AUDIO only, never shipped (not under media/).
// Two generated "tracks", deterministic: a soft two-tone chord (A3 + E4) and pink-ish noise under a slow swell,
// each 2 s, 8 kHz mono 16-bit WAV (~32 KB each), named <stem>.<h8>.wav like _media_lib's content-versioned files,
// and test_catalogue.json in the catalogue's schema (src/viewer/audio/music.js header). Re-running writes the
// same bytes (the gate checks the names are the hashes of the bytes and the durations are the files').
//   node tools/audio/fixtures/make_music_fixtures.js
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = __dirname, SR = 8000, SEC = 2;

function wav(samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}
const env = (i, n) => Math.min(1, i / (0.1 * SR), (n - i) / (0.1 * SR));   // 100 ms in and out: no click
function chord() {
  const n = SR * SEC, s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] = 0.25 * env(i, n) * (Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 329.63 * t)); }
  return s;
}
function noise() {
  const n = SR * SEC, s = new Float32Array(n);
  let x = 0x2545f491, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    const w = ((x >>> 0) / 4294967296) * 2 - 1;
    b0 = 0.997 * b0 + 0.029 * w; b1 = 0.985 * b1 + 0.032 * w; b2 = 0.95 * b2 + 0.048 * w;   // a cheap pink-ish tilt
    s[i] = 0.9 * env(i, n) * (0.5 + 0.5 * Math.sin(Math.PI * i / n)) * (b0 + b1 + b2);
  }
  return s;
}
const TRACKS = [
  { id: 'test_chord', stem: 'test_chord', gen: chord, title: 'Test Chord', artist: 'flyDiy test generator', album: 'GATE AUDIO fixtures',
    contexts: ['garage', 'welcome'], lufs: -18 },
  { id: 'test_noise', stem: 'test_noise', gen: noise, title: 'Test Noise Swell', artist: 'flyDiy test generator', album: 'GATE AUDIO fixtures',
    contexts: ['garage', 'cruise', 'photo'], lufs: -15 },
];
for (const f of fs.readdirSync(DIR)) if (/^test_(chord|noise)\.[0-9a-f]{8}\.wav$/.test(f)) fs.unlinkSync(path.join(DIR, f));
const cat = TRACKS.map(t => {
  const buf = wav(t.gen()), h8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const file = 'tools/audio/fixtures/' + t.stem + '.' + h8 + '.wav';
  fs.writeFileSync(path.join(DIR, t.stem + '.' + h8 + '.wav'), buf);
  return { id: t.id, file, title: t.title, artist: t.artist, album: t.album, licence: 'CC0',
    source: 'tools/audio/fixtures/make_music_fixtures.js', contexts: t.contexts, lufs: t.lufs, durationS: SEC };
});
fs.writeFileSync(path.join(DIR, 'test_catalogue.json'), JSON.stringify(cat, null, 2) + '\n');
console.log(cat.map(t => t.file).join('\n'));
