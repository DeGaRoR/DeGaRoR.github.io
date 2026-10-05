#!/usr/bin/env node
// SND-RADIO-3 (G1704): THE EVIDENCE - Radio Jolene as the game plays it, rendered offline.
//
//   node tools/audio/radio_broadcast.js     -> reports/evidence/SND-RADIO-3/ (README.md, summary.json, montage_20min.mp3,
//                                              transcript_2h.md, ad_*.mp3, interview.mp3; the guest voices: prep_voice --demo)
//
// THE WORDS are src/viewer/audio/radio_talk.js choosing from the SHIPPED broadcast (the media script the voice catalogue
// names), fed by JOLENE AS THE GAME SHIPS IT (tools/island_node.js on media/world/jolene + the premises fixture: the real
// world module, its day and climate) - the game's own day (the 8 kt breeze at four in the afternoon). THE TRACKS are the
// shipped catalogue's Radio Jolene tracks, dealt from a shuffle bag; a break every two tracks (the default).
// THE MIX follows music.js: each track at its catalogue trim (-16 LUFS); song to song an equal-power crossfade of 4 s; a
// break starts 6 s before the track's end (TALK_UP_S) - the voice over the outro, the outro fading out equal-power over
// what is left, the next track in under the voice at the 16 % bed (faded in over 1.5 s) and rising to its level over
// 1.5 s once the last take ends; the takes at music.js's clipK (1.25 x the 4 dB from -20 to -16 LUFS), sequenced with the
// talker's rests (0.7 s between segments, radio_talk.js's between the takes of one). The whole at -16 LUFS, -1 dBFS peak.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const OUT = at('reports/evidence/SND-RADIO-3');
const RT = require(at('src/viewer/audio/radio_talk.js'));
const PV = require('./prep_voice.js');
const CAT = JSON.parse(fs.readFileSync(at('src/viewer/audio/music_catalogue.json'), 'utf8'));
const VCAT = JSON.parse(fs.readFileSync(at('src/viewer/audio/voice_catalogue.json'), 'utf8'));
const SCRIPT = JSON.parse(fs.readFileSync(at(VCAT.script.file), 'utf8'));
const WRITTEN = JSON.parse(fs.readFileSync(at('tools/audio/radio_script.json'), 'utf8'));
const SR = 44100, XFADE_S = 4, TALK_UP_S = 6, BED_K = 0.16, BED_IN_S = 1.5, BED_UP_S = 1.5, SEG_REST = RT.SEG_REST, EVERY = 2;
const CLIP_K = 1.25 * Math.pow(10, (-16 - -20) / 20);
const ROOTS = CAT.filter(t => t.station === 'roots');
const trimOf = t => (typeof t.lufs === 'number' ? Math.max(0.25, Math.min(2, Math.pow(10, (-16 - t.lufs) / 20))) : 1);
const who = v => (WRITTEN.voices[v] && WRITTEN.voices[v].name) || v;
const clock = s => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return String(m).padStart(3, ' ') + ':' + String(x).padStart(2, '0'); };

// ---- decoding (ffmpeg: mono f32 at SR) -----------------------------------------------------------------------------
const cache = new Map();
function decode(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const r = cp.spawnSync('ffmpeg', ['-v', 'error', '-i', at(rel), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg: ' + rel + ' ' + r.stderr);
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4).slice();
  cache.set(rel, x);
  return x;
}
// a take as voice.js plays it: from its onset (the codec pad skipped: first sample above 1e-3, less 5 ms) for its dur
function take(key) {
  const it = SCRIPT.items[key], x = decode(it.file);
  let i0 = 0; for (let i = 0; i < Math.min(x.length, 0.15 * SR); i++) if (Math.abs(x[i]) > 1e-3) { i0 = Math.max(0, i - Math.round(0.005 * SR)); break; }
  return x.subarray(i0, Math.min(x.length, i0 + Math.round(it.dur * SR)));
}

// ---- the world -----------------------------------------------------------------------------------------------------
function jolene() {
  const { islandWorld } = require(at('tools/island_node.js'));
  const W = islandWorld('jolene', { premises: fs.readFileSync(at('tools/fixtures/island_jolene.json'), 'utf8') });
  if (!W) throw new Error('radio_broadcast: no Jolene');
  // the game's day (DAY_CLOCK's GAME_DAY: the 8 kt breeze), four in the afternoon
  W.setDay({ date: '2026-06-21', localHours: 16, storm: null, wind: { kts: 8, dirDeg: 250, gust: 0.15, refH: 10, breeze: 1 }, oatC: null, qnhPa: null, dewC: null });
  if (W.climate.refresh) W.climate.refresh();
  return W;
}

// ---- the broadcast: the events in order ------------------------------------------------------------------------------
// -> { tracks: [{ t, track, end }], breaks: [{ t, segs, tune }] } over `secs`, from a cursor
function broadcast(wx, secs, cursor, seed) {
  RT.setScript(SCRIPT);
  let a = seed || 7; const r = () => (a = (a * 16807) % 2147483647) / 2147483647;
  let bag = [], last = null;
  const next = () => {
    if (!bag.length) { bag = ROOTS.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } if (bag.length > 1 && bag[0] === last) { const j = 1 + Math.floor(r() * (bag.length - 1)); [bag[0], bag[j]] = [bag[j], bag[0]]; } }
    return (last = bag.shift());
  };
  const c = cursor || { v: '', k: 0, n: 0, h: {} }, tracks = [], breaks = [];
  let t = 0, tr = next(), since = 0, talk = true;
  breaks.push({ t: 0, k: null, segs: RT.breakScript(c, wx, [], { tuneIn: true }), tune: true });
  while (t < secs) {
    tracks.push({ t, track: tr, bed: talk });
    const dur = tr.durationS;
    since++;
    const brk = since >= EVERY;
    const end = t + dur - (brk ? Math.min(TALK_UP_S, dur / 3) : Math.min(XFADE_S, dur / 4));
    tracks[tracks.length - 1].fadeAt = end; tracks[tracks.length - 1].fadeS = brk ? Math.min(TALK_UP_S, dur / 3) : Math.min(XFADE_S, dur / 4);
    const prev = tr; tr = next(); t = end; talk = brk;
    if (brk) { since = 0; const k = c.k; breaks.push({ t, k, segs: RT.breakScript(c, wx, [{ id: prev.id, title: prev.title, artist: prev.artist }]) }); }
  }
  return { tracks, breaks, cursor: c };
}
// the voice of a break: [{ key, t }] from the break's start, and its length
function voiceOf(segs) {
  const o = []; let t = 0;
  segs.forEach((s, i) => {
    if (i) t += SEG_REST;
    for (const x of s.clips || []) { if (typeof x === 'number') { t += x; continue; } o.push({ key: x, t }); t += SCRIPT.items[x].dur; }
  });
  return { at: o, len: t };
}

// ---- the mix ---------------------------------------------------------------------------------------------------------
// equal-power fade from a to b over d (FA cos + FB sin, as music.js's fadeTo)
const ep = (a, b, x) => a * Math.cos(x * Math.PI / 2) + b * Math.sin(x * Math.PI / 2);
function mix(plan, secs) {
  const n = Math.round(secs * SR), y = new Float32Array(n);
  plan.breaks.forEach(b => { b.voice = voiceOf(b.segs); });
  const brAt = new Map(plan.breaks.map(b => [Math.round(b.t * 1000), b]));
  for (let ti = 0; ti < plan.tracks.length; ti++) {
    const T = plan.tracks[ti], x = decode(T.track.file), g = trimOf(T.track);
    const i0 = Math.round(T.t * SR);
    // a break starts with this track (it comes in at the bed), or a break's voice is still running when it starts (a
    // short track under a long break: music.js starts it at the bed too, PS[S_BED])
    const br = brAt.get(Math.round(T.t * 1000)) || plan.breaks.find(b => b.t < T.t && T.t < b.t + b.voice.len);
    const fadeIn = br ? BED_IN_S : (ti === 0 ? 0 : XFADE_S);
    const rise0 = br ? T.t + br.voice.len : null;
    const out0 = T.fadeAt, outS = T.fadeS;
    for (let i = 0; i < x.length; i++) {
      const j = i0 + i; if (j >= n) break;
      const ts = j / SR; let k;
      if (ts >= out0) { const u = Math.min(1, (ts - out0) / outS); if (u >= 1) break; k = ep(1, 0, u) * (br && ts < rise0 + BED_UP_S ? lvl(ts) : 1); }
      else k = br ? lvl(ts) : (fadeIn > 0 && ts - T.t < fadeIn ? ep(0, 1, (ts - T.t) / fadeIn) : 1);
      y[j] += x[i] * g * k;
    }
    function lvl(ts) {   // under a break: up to the bed, held, then the rise after the voice
      const d = ts - T.t;
      if (d < BED_IN_S) return ep(0, BED_K, d / BED_IN_S);
      if (ts < rise0) return BED_K;
      if (ts < rise0 + BED_UP_S) return ep(BED_K, 1, (ts - rise0) / BED_UP_S);
      return 1;
    }
  }
  for (const b of plan.breaks) for (const v of b.voice.at) {
    const x = take(v.key), j0 = Math.round((b.t + v.t) * SR);
    for (let i = 0; i < x.length && j0 + i < n; i++) y[j0 + i] += x[i] * CLIP_K;
  }
  // a fade at the end, then -16 LUFS with a look-ahead peak limiter holding -1 dBFS (5 ms ahead, 150 ms release)
  for (let i = 0; i < 3 * SR; i++) y[n - 1 - i] *= i / (3 * SR);
  const g = Math.pow(10, (-16 - PV.speechLufs(y, SR)) / 20), CEIL = 0.89, LA = Math.round(0.005 * SR), rel = Math.exp(-1 / (0.15 * SR));
  const need = new Float32Array(n);   // the gain each sample needs, the minimum over the look-ahead window
  for (let i = 0; i < n; i++) { const a = Math.abs(y[i] * g); need[i] = a > CEIL ? CEIL / a : 1; }
  const dq = []; let env = 1;
  for (let i = 0; i < n; i++) {
    const j = i + LA; if (j < n) { while (dq.length && need[dq[dq.length - 1]] >= need[j]) dq.pop(); dq.push(j); }
    while (dq.length && dq[0] < i) dq.shift();
    const m = dq.length ? Math.min(need[dq[0]], need[i]) : need[i];
    env = m < env ? m : 1 - (1 - env) * rel;
    y[i] = Math.max(-CEIL, Math.min(CEIL, y[i] * g * env));
  }
  return y;
}
function mp3(file, y, kbps) {
  const r = cp.spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', (kbps || 64) + 'k', file], { input: Buffer.from(y.buffer, y.byteOffset, y.byteLength) });
  if (r.status !== 0) throw new Error('ffmpeg encode: ' + r.stderr);
}
function joinTakes(keys, rest) {
  const parts = []; keys.forEach((k, i) => { if (i) parts.push(new Float32Array(Math.round(rest * SR))); parts.push(take(k)); });
  const y = new Float32Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { y.set(p, o); o += p.length; }
  return y;
}

// ---- the transcript --------------------------------------------------------------------------------------------------
function transcript(plan, title) {
  const md = ['# ' + title, ''], ev = [];
  for (const T of plan.tracks) ev.push({ t: T.t, s: '**♪ ' + (WRITTEN && T.track.title) + '** — ' + T.track.artist });
  for (const b of plan.breaks) {
    const lines = [];
    for (const s of b.segs) for (const k of s.items) { const it = SCRIPT.items[k]; lines.push('> **' + who(it.v) + (it.phone ? ' (on the phone)' : '') + '**: ' + it.text); }
    ev.push({ t: b.t + 0.001, s: '*' + (b.tune ? 'tuning in' : 'break ' + (b.k + 1) + ' of the program') + ' — ' + b.segs.map(x => x.kind).join(', ') + '*\n\n' + lines.join('\n>\n') });
  }
  ev.sort((a, b) => a.t - b.t);
  for (const e of ev) md.push('`' + clock(e.t) + '`  ' + e.s, '');
  return md.join('\n');
}

// ---- the horizon (the same measure as GATE AUDIO's RADIO_HORIZON) ------------------------------------------------------
function horizon() {
  const days = { 'the game\'s day': null, 'fog, morning': { visM: 500 }, 'a gale in a front': { gale: 1 }, 'a calm night': { night: 1 } };
  const W = jolene(), rows = [];
  for (const name in days) {
    const o = days[name];
    W.setDay({ date: '2026-06-21', localHours: o && o.night ? 23 : o && o.visM ? 8 : 16, storm: null,
      wind: o && o.gale ? { kts: 38, dirDeg: 160, gust: 0.4, refH: 10 } : o && o.night ? { kts: 1, dirDeg: 0, gust: 0, refH: 10 } : { kts: 8, dirDeg: 250, gust: 0.15, refH: 10, breeze: 1 },
      oatC: null, qnhPa: null, dewC: o && o.visM ? 14.9 : null });
    if (W.climate.refresh) W.climate.refresh();
    const wx = RT.readGame(W), k = RT.conditions(wx);
    const p = broadcast(wx, 6 * 3600, null, 7), seen = new Map(); let first = null, tot = 0, rep = 0;
    for (const b of p.breaks) for (const s of b.segs) for (const key of s.items) { tot++; if (seen.has(key)) { rep++; if (!first) first = { t: b.t, key }; } seen.set(key, b.t); }
    rows.push({ day: name, sky: k.sky, wind: k.wind, hazards: k.hazards, breaksIn2h: p.breaks.filter(b => b.t < 7200).length, firstRepeatH: first ? +(first.t / 3600).toFixed(2) : null, firstRepeat: first && first.key, repeatRate6h: +(rep / tot).toFixed(3) });
  }
  return rows;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const W = jolene(), wx = RT.readGame(W), cond = RT.conditions(wx);
  // THE TRANSCRIPT: two hours from the top of the program (a first session)
  const two = broadcast(wx, 2 * 3600, null, 7);
  fs.writeFileSync(path.join(OUT, 'transcript_2h.md'), transcript(two, 'Radio Jolene — the first two hours of the broadcast') + '\n');
  // THE MONTAGE: twenty minutes of a later session (the cursor at break 11 - a player tuning in again: the tune-in, then the
  // program's breaks 11 onward: the barge, the call-ins, the chief's interview)
  const cur = { v: '', k: 0, n: 0, h: {} };
  RT.setScript(SCRIPT);
  for (let i = 0; i < 10; i++) RT.breakScript(cur, wx, [{ id: ROOTS[i % ROOTS.length].id, title: 'x', artist: 'x' }]);
  const mont = broadcast(wx, 20 * 60, cur, 3);
  const y = mix(mont, 20 * 60);
  mp3(path.join(OUT, 'montage_20min.mp3'), y, 64);
  fs.writeFileSync(path.join(OUT, 'montage_20min.md'), transcript(mont, 'The montage — twenty minutes of a later session (tuned in at the program\'s break 11)') + '\n');
  // THE ADS (the three hand-polished) and THE INTERVIEW
  const ads = ['ad.cafe.1', 'ad.engine.1', 'ad.air.1'].filter(k => SCRIPT.items[k]);
  for (const k of ads) mp3(path.join(OUT, k.replace(/\./g, '_') + '.mp3'), joinTakes([k], 0), 64);
  const iv = Object.keys(SCRIPT.segments).find(s => SCRIPT.segments[s].cat === 'interview');
  if (iv) mp3(path.join(OUT, 'interview.mp3'), joinTakes(SCRIPT.segments[iv].items, RT.R_TURN), 64);
  const calls = Object.keys(SCRIPT.segments).filter(s => SCRIPT.segments[s].cat === 'call').slice(0, 1);
  for (const c of calls) mp3(path.join(OUT, 'call_in.mp3'), joinTakes(SCRIPT.segments[c].items, RT.R_TURN), 64);
  const hz = horizon();
  const size = f => fs.statSync(path.join(OUT, f)).size;
  const summary = { generated: 'node tools/audio/radio_broadcast.js', day: { windKt: +wx.windKt.toFixed(1), visM: Math.round(wx.visM), conditions: cond, declared: wx.declared },
    voice: { takes: VCAT.script.items, minutes: +(VCAT.script.seconds / 60).toFixed(1), MB: +(VCAT.script.bytes / 1048576).toFixed(2) },
    roots: ROOTS.length, horizon: hz, montage: { breaks: mont.breaks.length, tracks: mont.tracks.length, bytes: size('montage_20min.mp3') },
    ads: ads.map(k => ({ key: k, text: SCRIPT.items[k].text })), interview: iv ? SCRIPT.segments[iv].items.map(k => ({ who: who(SCRIPT.items[k].v), text: SCRIPT.items[k].text })) : null };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'README.md'), readme(summary, mont));
  console.log('radio_broadcast: ' + path.relative(ROOT, OUT) + ' (montage ' + (size('montage_20min.mp3') / 1048576).toFixed(1) + ' MB, ' + mont.breaks.length + ' breaks)');
  for (const r of hz) console.log('  ' + r.day + ': ' + r.sky + ' / ' + r.wind + ', ' + r.breaksIn2h + ' breaks in 2 h, first repeat ' + r.firstRepeatH + ' h (' + r.firstRepeat + '), repeat rate over 6 h ' + (r.repeatRate6h * 100).toFixed(0) + ' %');
}
function readme(sm, mont) {
  const cand = JSON.parse(fs.readFileSync(path.join(OUT, 'voices', 'candidates.json'), 'utf8'));
  const L = [];
  L.push('# SND-RADIO-3 — the living radio: what to listen for', '',
    'Generated by `node tools/audio/radio_broadcast.js` (and `node tools/audio/prep_voice.js --demo` for `voices/`). Everything here is what the game plays: ' +
    '`src/viewer/audio/radio_talk.js` choosing from the shipped broadcast (' + sm.voice.takes + ' whole takes, ' + sm.voice.minutes + ' minutes, ' + sm.voice.MB + ' MB of voice), ' +
    'on Jolene as the game ships it (the game\'s own day: ' + sm.day.windKt + ' kt, the sky read as **' + sm.day.conditions.sky + '**, the wind as **' + sm.day.conditions.wind + '**), ' +
    'over the shipped Radio Jolene tracks (' + sm.roots + '), mixed the way `music.js` mixes them.', '',
    '## The files', '',
    '| File | What it is |', '|---|---|',
    '| `montage_20min.mp3` | twenty minutes of a real broadcast, bed and fades included: a player tuning in again at the program\'s break 11 (the tune-in, then ' + (mont.breaks.length - 1) + ' breaks, holding: ' + [...new Set(mont.breaks.flatMap(b => b.segs.map(x => x.kind)))].join(', ') + '). Its words: `montage_20min.md` |',
    '| `transcript_2h.md` | the first two hours of the broadcast, word for word, with the tracks between |',
    '| `ad_cafe_1.mp3`, `ad_engine_1.mp3`, `ad_air_1.mp3` | three ads (the grammar\'s, polished by hand) |',
    '| `interview.mp3` | Norman and Chief Walt Brennan before the fair (norman + john) |',
    '| `call_in.mp3` | a resident on the phone (a LibriTTS voice through the phone line) |',
    '| `voices/` | the guest-voice candidates, the same line in each, dry and through the phone: pick by ear |', '');
  L.push('## What to listen for', '',
    '1. **No numbers.** The weather is a neighbour talking ("Sun and cloud are taking turns today"), two or three sentences that match the game\'s sky, wind and hazards. No digits, no zulu, no altimeter, no spelled letters anywhere.',
    '2. **Whole takes.** Every line is one Piper take (one per sentence, joined with a breath that varies a little), never stitched from word clips: the punctuation is the speaker\'s. Listen to the commas in the ads and the back-announces.',
    '3. **The prosody.** Norman a touch slower than the model (length_scale 1.06), the rhythm loosened (noise_w 0.90), the voice steadier (noise_scale 0.62), 0.34 s between sentences, a little more after a question. All in `tools/audio/voice_render.py` PROSODY. If it sounds too slow or too loose, that table is the knob.',
    '4. **The talk-up.** At a break the song does not stop: Norman starts six seconds before the end, over the fading outro, and the next song comes in under him at the bed, rising when he stops. Song to song without talk: a 4 s equal-power crossfade, in the garage too (no silences on Radio Jolene).',
    '5. **The credit.** "That was Matthew C. Wright, A Cloudy Life." The titles as a person says them (`voice_script.json` titles): no store-listing words.',
    '6. **The island.** A recurring cast (the Pruitt kids and Biscuit, Carl\'s skiff, Mae\'s pies, Chief Brennan, Officer Hale, Gus at the harbour), threads that move on (lost, sighted, home), the businesses\' ads, the call-ins on the phone line.',
    '7. **The guest voices** (`voices/`): john as the chief, kristin as the officer, LibriTTS speakers for the callers. The phone colour (300-3400 Hz, light saturation) is baked at render time.', '');
  L.push('## The guest voices (clean licences only, each read off its model card)', '',
    '| Voice | Role | Dataset — licence | Lineage |', '|---|---|---|---|',
    '| en_US-norman-medium | Norman, the host (the user\'s pick) | LibriVox, one reader — public domain | trained from scratch |',
    '| en_US-john-medium | Chief Walt Brennan | LibriVox, one reader — public domain | fine-tuned from kristin, itself from scratch on public-domain LibriVox |',
    '| en_US-kristin-medium | Officer Dana Hale | LibriVox, one reader — public domain | trained from scratch |',
    '| en_US-libritts-high | the residents who phone in (speakers ' + cand.rows.filter(r => r.voice === 'libritts' && !r.phone).map(r => r.speaker).join(', ') + ') | LibriTTS train-clean-360 — CC BY 4.0 (credit: Zen et al., Google; openslr.org/60) | trained from scratch |', '',
    'Engine: Piper 1.2.0 + piper-phonemize 1.1.0, MIT, a render tool only. The model cards are in `voices/cards/`. The dataset pages (openslr.org, librivox.org, keithito.com) and Hugging Face are blocked by this container\'s network policy: the licences are the model cards\' own (shipped in the voice tarballs, the same as rhasspy/piper-voices\'), as for SND-VOICE. Voices fine-tuned from lessac (most Piper English voices) are refused, as SND-VOICE found.', '');
  L.push('## Repeats', '',
    '| Day (as the game read it) | Breaks in 2 h | First repeat | Repeat rate over 6 h |', '|---|---|---|---|');
  for (const r of sm.horizon) L.push('| ' + r.sky + ', ' + r.wind + ' | ' + r.breaksIn2h + ' | ' + (r.firstRepeatH == null ? 'none in 6 h' : r.firstRepeatH + ' h (' + r.firstRepeat + ')') + ' | ' + (r.repeatRate6h * 100).toFixed(0) + ' % |');
  L.push('', 'A break every two tracks (the default). The program is ' + SCRIPT.program.length + ' breaks long; the pools (station IDs, weather, back-announces) choose the least recently heard take that fits. GATE AUDIO\'s RADIO_HORIZON holds two hours repeat-free on the shipped catalogue.', '');
  return L.join('\n') + '\n';
}
if (require.main === module) main();
module.exports = { broadcast, voiceOf, horizon };
