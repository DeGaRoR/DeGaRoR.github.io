// SND-ASSETS: short listening excerpts for the user's listening boards (SOUND-2026-10-04 §7.1 step 2).
//
//   node tools/audio/excerpt.js --music  [--out <dir>]   every downloaded track → 60 s from 25 % in, stereo, 112 kbps MP3
//   node tools/audio/excerpt.js --sounds [--out <dir>]   every downloaded CC0 sound → ≤ 25 s from the middle, mono, 96 kbps
//
// Decoding: audio-decode (WASM decoders, MIT); encoding: lamejs (LGPL, a TOOL dependency only — nothing it
// produces carries its licence and it never ships). Also measures the integrated loudness (BS.1770 K-weighting,
// ungated mean — enough to rank and to level the board) and the peak.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

async function decode(file) {
  const mod = await import('audio-decode');
  const buf = await (mod.default || mod)(fs.readFileSync(file));
  // audio-decode 3 answers {channelData, sampleRate}; older versions an AudioBuffer
  const ch = buf.channelData || Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  return { sr: buf.sampleRate, ch };
}

// BS.1770 K-weighting (two biquads), mean-square over all channels → LUFS (ungated)
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function kweight(x, sr) {
  // pre-filter (high shelf +4 dB @ ~1.5 kHz) and RLB high-pass, from BS.1770's analogue prototypes
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  let y = biquad(x, (Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
    2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  a0 = 1 + K / Q + K * K;
  return biquad(y, 1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
}
function loudness(ch, sr) {
  let ms = 0;
  for (const x of ch) { const y = kweight(x, sr); let s = 0; for (let i = 0; i < y.length; i++) s += y[i] * y[i]; ms += s / y.length; }
  return -0.691 + 10 * Math.log10(ms + 1e-12);
}
function peak(ch) { let p = 0; for (const x of ch) for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; }

function cut(ch, sr, t0, dur, fade) {
  const n0 = Math.max(0, Math.floor(t0 * sr)), n = Math.min(Math.floor(dur * sr), ch[0].length - n0);
  const nf = Math.floor(fade * sr);
  return ch.map(x => {
    const y = x.slice(n0, n0 + n);
    for (let i = 0; i < nf && i < n; i++) { const g = i / nf; y[i] *= g; y[n - 1 - i] *= g; }
    return y;
  });
}

function encodeMp3(ch, sr, kbps) {
  // lamejs 1.2.1's CommonJS entry throws "MPEGMode is not defined" under node; its own browser bundle works
  const lame = encodeMp3.lame || (encodeMp3.lame = new Function(
    fs.readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8') + ';return lamejs;')());
  const nc = Math.min(2, ch.length);
  const enc = new lame.Mp3Encoder(nc, sr, kbps);
  const toI16 = x => { const o = new Int16Array(x.length); for (let i = 0; i < x.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))); return o; };
  const L = toI16(ch[0]), R = nc > 1 ? toI16(ch[1]) : null;
  const out = [];
  for (let i = 0; i < L.length; i += 1152) {
    const b = nc > 1 ? enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152)) : enc.encodeBuffer(L.subarray(i, i + 1152));
    if (b.length) out.push(Buffer.from(b));
  }
  const e = enc.flush(); if (e.length) out.push(Buffer.from(e));
  return Buffer.concat(out);
}

async function run(kind, outDir) {
  const isMusic = kind === 'music';
  const ledgerFile = path.join(ROOT, 'assets', 'audio', isMusic ? 'music_ledger.json' : 'ledger.json');
  const L = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const rows = Object.values(isMusic ? L.tracks : L.sounds).filter(r => r.raw);
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  for (const r of rows) {
    try {
      const { sr, ch } = await decode(path.join(ROOT, r.raw));
      const total = ch[0].length / sr;
      r.durationS = +total.toFixed(1);
      r.lufs = +loudness(ch, sr).toFixed(1);
      r.peak = +peak(ch).toFixed(3);
      let x;
      if (isMusic) x = cut(ch, sr, total * 0.25, Math.min(60, total), 2);
      else {
        const d = Math.min(25, total);
        const mono = ch.length > 1 ? [ch[0].map((v, i) => 0.5 * (v + ch[1][i]))] : ch;
        x = cut(mono, sr, Math.max(0, total / 2 - d / 2), d, Math.min(0.5, d / 8));
      }
      // level the board: excerpts to −18 LUFS (music) / −23 LUFS (sounds), never above −1 dBFS peak
      const target = isMusic ? -18 : -23;
      let g = Math.pow(10, (target - loudness(x, sr)) / 20);
      const pk = peak(x) * g; if (pk > 0.89) g *= 0.89 / pk;
      x = x.map(c => c.map(v => v * g));
      const name = `${r.id}.mp3`;
      fs.writeFileSync(path.join(outDir, name), encodeMp3(x, sr, isMusic ? 112 : 96));
      index.push({ id: r.id, file: name, title: r.title, artist: r.artist || r.author, album: r.album || null,
        tags: r.tags, durationS: r.durationS, lufs: r.lufs, licence: r.licence || r.albumLicence, page: r.page });
      console.log('ok', r.id, r.durationS + ' s', r.lufs + ' LUFS', r.title);
    } catch (e) { console.log('FAIL', r.id, r.title, e.message); }
  }
  fs.writeFileSync(ledgerFile, JSON.stringify(L, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  console.log(index.length, 'excerpts →', outDir);
}

module.exports = { decode, loudness, peak, cut, encodeMp3 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const kind = argv.includes('--music') ? 'music' : argv.includes('--sounds') ? 'sounds' : null;
  if (!kind) { console.log('usage: --music | --sounds [--out dir]'); process.exit(1); }
  run(kind, oi >= 0 ? argv[oi + 1] : path.join(ROOT, 'assets', 'audio', 'board', kind)).catch(e => { console.error(e); process.exit(1); });
}
