#!/usr/bin/env node
// RADIO JOLENE'S BREAKS IN NORMAN'S VOICE (G1684, SND-RADIO-2; SOUND-2026-10-04 §7 / §8 evidence, ruling s12).
//
// What a break now SOUNDS like: src/viewer/audio/radio_talk.js writes it from THE GAME (Jolene as shipped -
// tools/island_node.js on media/world/jolene + the premises fixture, the real world module - under the three weather
// panel days of tools/audio/radio_scripts.js), the talker resolves each segment to its recorded clips (the shipped
// src/viewer/audio/voice_catalogue.json: norman), and the clips are laid end to end exactly as AUDIO_VOICE.play
// schedules them (VOICE_MODEL.timeline: the catalogue's dur, the codec pad skipped by voice.js's own onset rule,
// RADIO_TALK.SEG_REST between segments) OVER A MUSIC BED the way music.js plays it: the next roots track starts under
// the voice at BED_K (16 %) faded in over BED_IN_S, and rises to its level over BED_UP_S (equal power) when the last
// clip ends. The voice's level is music.js's clipK (VOICE_K x the clips' -20 LUFS brought to the tracks' -16).
// A segment the clips cannot say would be read by speechSynthesis in the game: it is marked, not rendered.
//
//   node tools/audio/radio_break_render.js   -> reports/evidence/SND-RADIO-2/{README.md, summary.json, <weather>.opus}
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const OUT = at('reports/evidence/SND-RADIO-2');
global.VOICE_MODEL = require(at('src/viewer/audio/voice_model.js'));   // (radio_talk.js finds it as a global, as on the page)
const R = require(at('src/viewer/audio/radio_talk.js'));
const VM = global.VOICE_MODEL;
const VCAT = JSON.parse(fs.readFileSync(at('src/viewer/audio/voice_catalogue.json'), 'utf8'));
const MCAT = JSON.parse(fs.readFileSync(at('src/viewer/audio/music_catalogue.json'), 'utf8'));
const { WEATHERS } = require('./radio_scripts.js');
const SR = 48000;
// music.js's numbers (read from its head, so the evidence follows the player)
const MUSIC = fs.readFileSync(at('src/viewer/audio/music.js'), 'utf8');
const num = re => +MUSIC.match(re)[1];
const BED_K = num(/BED_K = ([\d.]+)/), BED_IN_S = num(/BED_IN_S = ([\d.]+)/), BED_UP_S = num(/BED_UP_S = ([\d.]+)/);
const VOICE_K = 1 / num(/VOICE_K = 1 \/ ([\d.]+)/), LUFS_TARGET = num(/LUFS_TARGET = (-[\d.]+)/);
const CLIP_K = VOICE_K * Math.pow(10, (LUFS_TARGET - VCAT.voice.render.lufs) / 20);

function decode(file) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', at(file), '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 29 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength >> 2).slice();
}
// voice.js's onset: the first sample above 1e-3 within 0.15 s, less 5 ms (lamejs writes no LAME tag: the pad stays)
function onset(x) { const n = Math.min(x.length, Math.round(0.15 * SR)); for (let i = 0; i < n; i++) if (Math.abs(x[i]) > 1e-3) return Math.max(0, i / SR - 0.005); return 0; }
const clipBuf = new Map();
function clip(key) {
  if (!clipBuf.has(key)) { const c = VCAT.clips[key], x = decode(c.file), off = Math.round(onset(x) * SR); clipBuf.set(key, x.subarray(off, off + Math.round(c.dur * SR))); }
  return clipBuf.get(key);
}
const loud = x => { const X = require('./excerpt.js'); return X.loudness([x], SR); };

// one break: { kind, text, clips, resolved } per segment, the voice track, its length
function voiceOf(segs) {
  const rows = [], seq = [];
  for (const s of segs) {
    const miss = (s.clips || []).filter(k => typeof k === 'string' && !VCAT.clips[k]);
    const ok = !!s.clips && !miss.length;
    rows.push({ kind: s.kind, key: s.key, text: s.text, clips: ok ? s.clips.filter(k => typeof k === 'string').length : 0, resolved: ok, missing: miss });
    if (!ok) continue;   // (speechSynthesis in the game: not rendered here)
    if (seq.length) seq.push(R.SEG_REST);
    for (const k of s.clips) seq.push(k);
  }
  const tl = VM.timeline(seq, k => VCAT.clips[k].dur);
  const y = new Float32Array(Math.ceil(tl.total * SR) + 1);
  for (const a of tl.at) { const x = clip(a.key), o = Math.round(a.t * SR); for (let i = 0; i < x.length && o + i < y.length; i++) y[o + i] += x[i]; }
  return { rows, y, secs: tl.total, keys: tl.at.length };
}
// the break over its bed: the track in at BED_K over BED_IN_S, the voice from LEAD (the clips' first load + play's 50 ms),
// the rise over BED_UP_S equal-power once the voice ends, then TAIL s of the track at its level
const LEAD = 0.35, TAIL = 6, FADE_OUT = 1.5;
function overBed(v, track, trackStart) {
  const m = track.x, trim = Math.max(0.25, Math.min(2, Math.pow(10, (LUFS_TARGET - track.t.lufs) / 20)));
  const vEnd = LEAD + v.secs, n = Math.round((vEnd + BED_UP_S + TAIL) * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let g;
    if (t < BED_IN_S) { const p = t / BED_IN_S * Math.PI / 2; g = BED_K * Math.sin(p); }
    else if (t < vEnd) g = BED_K;
    else if (t < vEnd + BED_UP_S) { const p = (t - vEnd) / BED_UP_S * Math.PI / 2; g = BED_K * Math.cos(p) + Math.sin(p); }
    else g = 1;
    const tail = n / SR - t; if (tail < FADE_OUT) g *= tail / FADE_OUT;
    const mi = Math.round(trackStart * SR) + i;
    out[i] = (mi < m.length ? m[mi] : 0) * trim * g;
  }
  const o = Math.round(LEAD * SR);
  for (let i = 0; i < v.y.length && o + i < n; i++) out[o + i] += v.y[i] * CLIP_K;
  return out;
}

function main() {
  const { islandWorld } = require(at('tools/island_node.js'));
  const W = islandWorld('jolene', { premises: fs.readFileSync(at('tools/fixtures/island_jolene.json'), 'utf8') });
  if (!W) throw new Error('radio_break_render: no Jolene');
  const roots = MCAT.filter(t => t.station === 'roots');
  if (!roots.length) throw new Error('radio_break_render: no roots track for the bed');
  const tracks = MCAT.map(t => ({ id: t.id, title: t.title, artist: t.artist }));
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { generated: 'node tools/audio/radio_break_render.js', voice: VCAT.voice.id, clipK: +CLIP_K.toFixed(4), bedK: BED_K, weathers: [] };
  let ti = 0;
  for (const wx0 of WEATHERS) {
    W.setDay(Object.assign({ date: '2026-06-21', localHours: wx0.localHours, storm: null }, wx0.day));
    if (wx0.stormInS) W.setDay({ storm: { at: W.day.utc + wx0.stormInS, intensity: 1 } });
    if (W.climate.refresh) W.climate.refresh();
    const wx = R.readGame(W), st = { k: 0 };
    // the tune-in, then the rotation's breaks until the pilots' notes and the marine forecast have both been heard
    const breaks = [{ title: 'Tuning in', segs: R.breakScript(st, wx, [], { tuneIn: true }) }];
    for (let i = 0; i < 4; i++) {
      const segs = R.breakScript(st, wx, [tracks[(2 * i) % tracks.length], tracks[(2 * i + 1) % tracks.length]]);
      if (segs.some(s => s.kind === 'pilots' || s.kind === 'marine')) breaks.push({ title: 'Break ' + (i + 1), segs });
    }
    const parts = [], rows = [];
    let t = 0;
    for (const b of breaks) {
      const v = voiceOf(b.segs), tr = roots[ti++ % roots.length];
      const track = { t: tr, x: decode(tr.file) };
      const y = overBed(v, track, 20);
      rows.push({ title: b.title, at: +t.toFixed(2), voiceS: +v.secs.toFixed(2), clips: v.keys, bed: tr.title + ' — ' + tr.artist, segments: v.rows });
      parts.push(y, new Float32Array(Math.round(0.8 * SR))); t += (y.length / SR) + 0.8;
    }
    const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    const L = loud(all), g = Math.pow(10, (-16 - L) / 20);
    let pk = 0; for (let i = 0; i < all.length; i++) { all[i] *= g; pk = Math.max(pk, Math.abs(all[i])); }
    if (pk > 0.95) for (let i = 0; i < all.length; i++) all[i] *= 0.95 / pk;
    const f32 = path.join(require('os').tmpdir(), 'radio_break_' + wx0.key + '.f32');
    fs.writeFileSync(f32, Buffer.from(all.buffer));
    const file = wx0.key + '.opus';
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', f32, '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio', path.join(OUT, file)]);
    fs.unlinkSync(f32);
    summary.weathers.push({ key: wx0.key, title: wx0.title, file, seconds: +(all.length / SR).toFixed(1),
      numbers: { windKt: +wx.windKt.toFixed(1), windDirT: +wx.windDirT.toFixed(1), gust: wx.gust, visM: Math.round(wx.visM), oatC: +wx.oatC.toFixed(1), dewC: +wx.dewC.toFixed(1), qnhPa: Math.round(wx.qnhPa), seaFt: +wx.seaFt.toFixed(1), storm: wx.storm && wx.storm.phase, declared: wx.declared },
      breaks: rows });
    console.log(file + ': ' + (all.length / SR).toFixed(1) + ' s, ' + rows.length + ' breaks, ' + rows.reduce((a, r) => a + r.segments.filter(s => !s.resolved).length, 0) + ' segments unresolved');
  }
  summary.unresolved = summary.weathers.reduce((a, w) => a + w.breaks.reduce((b, r) => b + r.segments.filter(s => !s.resolved).length, 0), 0);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'README.md'), readme(summary));
  console.log('radio_break_render: ' + path.relative(ROOT, OUT));
}

function readme(S) {
  const md = ['# SND-RADIO-2 — Radio Jolene\'s breaks in norman\'s voice', '',
    'Generated by `node tools/audio/radio_break_render.js` (do not edit by hand). Each file is what the game plays at a talk break on the roots station, rendered offline:',
    '', '- **the words** — `src/viewer/audio/radio_talk.js` writes the break from **Jolene as the game ships it** (`tools/island_node.js` on `media/world/jolene` + `tools/fixtures/island_jolene.json`: the real world module, its DAY, CLIMATE, sea and aerodromes) under three days of the weather panel (`tools/audio/radio_scripts.js`\'s WEATHERS);',
    '- **the voice** — every segment resolved to its recorded clips in the shipped catalogue (`src/viewer/audio/voice_catalogue.json`, voice **' + S.voice + '**, the user\'s pick), laid end to end exactly as `AUDIO_VOICE.play` schedules them (`VOICE_MODEL.timeline`: each clip\'s catalogue length from its codec-pad onset, the sequence\'s rests, `RADIO_TALK.SEG_REST` between segments). The AWOS is `VOICE_MODEL.awosClips` on the game\'s observation (`RADIO_TALK.obsOf`): recorded words and digits assembled the way real automated stations talk;',
    '- **the bed** — a roots track starts under the voice at ' + Math.round(S.bedK * 100) + ' % (faded in over 1.5 s) and rises to its level over 1.5 s (equal power) once the last clip ends, then plays 6 s; the voice at `clipK` = ' + S.clipK + ' (VOICE_K 1.25 x the clips\' −20 LUFS brought to the tracks\' −16). Each file levelled to −16 LUFS, Opus 48 kb/s mono.',
    '', 'In the game a segment the clips cannot say (a place or a number with no clip) is read by `speechSynthesis` instead, per segment; on Jolene under these three days ' +
    (S.unresolved ? '**' + S.unresolved + ' segment(s) do not resolve** and would be spoken (marked below; silent here)' : '**every segment resolves**') + ' (the table says so per segment).', ''];
  for (const w of S.weathers) {
    const n = w.numbers;
    md.push('## ' + w.title + ' — [`' + w.file + '`](' + w.file + ') (' + w.seconds + ' s)', '',
      'Read off the game: wind ' + n.windKt + ' kt from ' + n.windDirT + '° true (gust ' + n.gust + '), visibility ' + n.visM + ' m, ' + n.oatC + ' / ' + n.dewC + ' °C, QNH ' + (n.qnhPa / 100).toFixed(1) + ' hPa, seas ' + n.seaFt + ' ft' + (n.storm ? ', a front (' + n.storm + ')' : '') + '. Declared: ' + (n.declared.length ? n.declared.join('; ') : 'nothing') + '.', '',
      '| at | break | voice | bed | segment | played as | words |', '|---|---|---|---|---|---|---|');
    for (const b of w.breaks) b.segments.forEach((s, i) => md.push('| ' + (i ? '' : b.at.toFixed(1) + ' s') + ' | ' + (i ? '' : b.title) + ' | ' + (i ? '' : b.voiceS + ' s, ' + b.clips + ' clips') + ' | ' + (i ? '' : b.bed) + ' | ' + s.kind + ' | ' +
      (s.resolved ? s.clips + ' clips' : '**speech** (missing ' + s.missing.join(', ') + ')') + ' | ' + s.text.replace(/\|/g, '/') + ' |'));
    md.push('');
  }
  md.push('## What to listen for', '',
    '- the station ID and the greeting are whole recorded lines; the time check is "The time on the island," + the hour + the minutes (one take each);',
    '- the AWOS is word by word, digits one by one with a continuing take inside a group and a falling one at its end ("two, five, zero" ... "eight.");',
    '- the back-announce is one take per track ("That was <title>, by <artist>.") then "Before that," + the title + "by" + the artist;',
    '- the pilots\' notes: the favoured runway assembled (its digits, the wind), the one-way strip and the sea lane as whole recorded lines (one per place), the eagles\' line with the part of the day;',
    '- the bed: 16 % under the whole break, the 1.5 s rise after the last clip.', '');
  return md.join('\n');
}
if (require.main === module) main();
