#!/usr/bin/env node
// GATE MIXLEAD (G1727, SND-MIX-2): THE ENGINE LEADS - asserted on tools/audio/mix_render.js's own numbers.
//
// The user (2026-10-13, train 38): "engine sound remains too faint compared to the rest... Even when at max... Your engine
// is quieter than a metal squeal". mix_render.js renders the page's whole mix offline from the page's files; this gate
// runs it on the Jodel in the states where the user heard it and asserts the Coordinator's targets (SND-MIX-2):
//   COCKPIT CRUISE (the radio on)  the engine + prop's short-term loudness (3 s, its median) leads the airframe's loudest
//                                  3 s by >= 8 LU; the music sits >= 10 LU under it, the ambience and the emitters >= 15
//   CHASE IDLE (the stand)         the engine leads the airframe, the ambience and the emitters by >= 6 LU
//   TAXI ON THE BRAKES             the engine leads the airframe (the brakes' friction, the ground) by >= 8 LU in the cockpit
//                                  and >= 6 in chase; the brakes alone (soloed) stay >= 11 LU under in both (the brief's floor
//                                  is 6 for any texture; 11 is this branch's design margin - 13-16 measured - so the old held
//                                  1250 Hz squeal, 8-10 LU under once the airframe's trim came down, still turns it red)
//   CHASE TOUCHDOWN (2 m/s sink)   the airframe's momentary max (0.4 s: the touchdown, the chirp, the thump) <= +3 LU over
//                                  the engine's short-term level at idle
//   THE ENGINE AT 200 %            (the slider's top, G1728) the cockpit climb - the loudest state - peaks <= -1 dBFS
//                                  after the limiter, which never reduces more than 1 dB
// and every assertion mutated red (the old brake squeal, the old chirp and touchdown, the engine's trim lost, the music's old
// trim, a hot cabin wind, the cockpit trim pushed into the limiter). The sources are held in memory (mix_render.setSources): the
// files on disk are never written and are byte-identical at the end. ~1-2 min.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
// SKIP ON A MACHINE WITHOUT ffmpeg (A0's box, train 54 held: the gate threw there). mix_render decodes the shipped MP3s -
// the ambience, the emitters, the music, the voice - with ffmpeg, which the box does not have; the gate is then a cloud
// session's, exactly as SOFTGPU's without Playwright (run_gates.js, train 31's rule: `GATE <ID>: SKIP`, exit 0, shown as
// SKIP - never a PASS, never a FAIL). Checked before mix_render is even loaded.
{ let have = true; try { require('child_process').execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch (e) { have = false; }
  if (!have) { console.log('  no ffmpeg here - the mix render decodes the shipped MP3s with it: the gate runs in a cloud session (G1727)'); console.log('GATE MIXLEAD: SKIP'); process.exit(0); } }
const MR = require('./mix_render.js');
const FILES = { audio: 'src/viewer/audio/audio.js', model: 'src/viewer/audio/airframe_model.js', worklet: 'src/viewer/audio/airframe_worklet.js' };
const readAll = () => { const S = {}; for (const k in FILES) S[k] = fs.readFileSync(path.join(ROOT, FILES[k]), 'utf8'); return S; };
const shaOf = S => crypto.createHash('sha256').update(Object.keys(FILES).map(k => S[k]).join('\u0000')).digest('hex');
let fails = 0;
const say = (ok, m) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FAIL ') + m); };

// THE PROBES: [name, build, state, cockpit?, options, the assertion on the row -> failures]
const BRK_UNDER = 11;
const lead = (r, k) => r.st.enginePlusProp.stMed - (r.st[k] && r.st[k].st != null ? r.st[k].st : -Infinity);
const PROBES = {
  cruiseCockpit: ['jodel', 'cruise', 1, { music: true, study: true, layers: [] }, r => {
    const F = [];
    if (!(lead(r, 'airframe') >= 8)) F.push('cockpit cruise: the engine leads the airframe by ' + lead(r, 'airframe').toFixed(1) + ' LU (want >= 8)');
    if (!(lead(r, 'music') >= 10)) F.push('cockpit cruise: the music sits ' + lead(r, 'music').toFixed(1) + ' LU under the engine (want >= 10)');
    for (const k of ['ambience', 'emitters']) if (!(lead(r, k) >= 15)) F.push('cockpit cruise: the ' + k + ' sits ' + lead(r, k).toFixed(1) + ' LU under the engine (want >= 15)');
    return F; }],
  idleChase: ['jodel', 'idle', 0, { study: true, layers: [] }, r => {
    const F = [];
    for (const k of ['airframe', 'ambience', 'emitters']) if (!(lead(r, k) >= 6)) F.push('chase idle: the engine leads the ' + k + ' by ' + lead(r, k).toFixed(1) + ' LU (want >= 6)');
    return F; }],
  brakeCockpit: ['jodel', 'taxiBrake', 1, { study: true, noAmb: true, layers: ['brake'] }, r => {
    const F = [];
    if (!(lead(r, 'airframe') >= 8)) F.push('cockpit taxi on the brakes: the engine leads the airframe by ' + lead(r, 'airframe').toFixed(1) + ' LU (want >= 8)');
    const b = r.st.enginePlusProp.stMed - r.layers.brake.st;
    if (!(b >= BRK_UNDER)) F.push('cockpit taxi on the brakes: the brakes alone sit ' + b.toFixed(1) + ' LU under the engine (want >= ' + BRK_UNDER + ')');
    return F; }],
  brakeChase: ['jodel', 'taxiBrake', 0, { study: true, noAmb: true, layers: ['brake'] }, r => {
    const F = [];
    if (!(lead(r, 'airframe') >= 6)) F.push('chase taxi on the brakes: the engine leads the airframe by ' + lead(r, 'airframe').toFixed(1) + ' LU (want >= 6)');
    const b = r.st.enginePlusProp.stMed - r.layers.brake.st;
    if (!(b >= BRK_UNDER)) F.push('chase taxi on the brakes: the brakes alone sit ' + b.toFixed(1) + ' LU under the engine (want >= ' + BRK_UNDER + ')');
    return F; }],
  touchdownChase: ['jodel', 'touchdown', 0, { study: true, noAmb: true, layers: [] }, r => {
    const over = r.st.airframe.m - r.st.enginePlusProp.stMed;
    return over <= 3 ? [] : ['chase touchdown: the airframe\'s momentary max is ' + over.toFixed(1) + ' LU over the idling engine (want <= +3)']; }],
  climbTop: ['jodel', 'climb', 1, { engine: 2, noAmb: true }, r => {
    const F = [];
    if (!(r.buses.master.peak <= -1)) F.push('the engine at 200 %, cockpit climb: the master peaks at ' + r.buses.master.peak + ' dBFS (want <= -1)');
    if (!(r.limiter.grMaxDb <= 1)) F.push('the engine at 200 %, cockpit climb: the limiter reduces ' + r.limiter.grMaxDb + ' dB (want <= 1)');
    return F; }],
};
async function run(S, names) {
  MR.setSources({ [FILES.audio]: S.audio, [FILES.model]: S.model, [FILES.worklet]: S.worklet });
  const out = {};
  for (const n of names) {
    const [b, s, inn, o, test] = PROBES[n];
    const r = await MR.measureState(b, s, inn, o);
    out[n] = { F: test(r), r };
  }
  MR.setSources(null);
  return out;
}
// THE MUTATIONS: [name, file, find, replace, the probes that must turn red, also(text)]
const MUT = [
  ['the brakes\' old held squeal', 'worklet', 'const sqG = wn > 0.9 ? (wn > 1.9 ? 1 : wn - 0.9) : 0;', 'const sqG = 1;', ['brakeCockpit', 'brakeChase'], t => t.replace('BRK_SQ = 0.006,', 'BRK_SQ = 0.05,')],
  ['the chirp\'s old level', 'worklet', 'k * (0.01 + 0.025 * s)', 'k * (0.06 + 0.14 * s)', ['touchdownChase']],
  ['the touchdown\'s old level', 'worklet', 'k * (0.035 + 0.15 * s)', 'k * (0.08 + 0.35 * s)', ['touchdownChase']],
  ['the engine\'s trim lost', 'audio', 'const MIX = { engine: 8,', 'const MIX = { engine: 0,', ['cruiseCockpit', 'idleChase']],
  ['the music\'s old trim', 'audio', 'ambienceRun: -10, music: -10 }', 'ambienceRun: -10, music: -6 }', ['cruiseCockpit']],
  ['a cabin wind 13 dB hotter', 'model', 'windCab: 0.09,', 'windCab: 0.4,', ['cruiseCockpit']],
  ['the cockpit pushed into the limiter', 'audio', 'const MIX = { engine: 8, interior: 6,', 'const MIX = { engine: 8, interior: 14,', ['climbTop']],
];

(async () => {
  const SRC0 = readAll(), SHA0 = shaOf(SRC0), only = process.argv.includes('--selftest');
  const base = await run(SRC0, Object.keys(PROBES));
  for (const n in base) {
    const r = base[n].r, e = r.st ? r.st.enginePlusProp.stMed : null;
    if (!only) say(!base[n].F.length, n + (base[n].F.length ? ': ' + base[n].F.join('; ') : ''));
    if (!only) console.log('  info ' + n.padEnd(15) + (e != null ? ' e+p ' + e + ' LUFS (3 s), airframe ' + r.st.airframe.st + ' (3 s) / ' + r.st.airframe.m + ' (0.4 s)' +
      (r.st.music ? ', music ' + r.st.music.st : '') + ', ambience ' + r.st.ambience.st + (r.layers && r.layers.brake ? ', brakes ' + r.layers.brake.st : '') : '') +
      ' | master peak ' + r.buses.master.peak + ' dBFS, GR max ' + r.limiter.grMaxDb + ' dB');
  }
  let caught = 0;
  for (const [name, file, find, repl, probes, also] of MUT) {
    const green = probes.filter(p => !base[p].F.length);
    if (green.length !== probes.length) { say(false, 'SELF-TEST "' + name + '": ' + probes.filter(p => base[p].F.length).join(', ') + ' already red - nothing to prove'); continue; }
    const n = SRC0[file].split(find).length - 1;
    if (n !== 1) { say(false, 'SELF-TEST "' + name + '": the anchor is found ' + n + ' times in ' + FILES[file] + ' (want 1)'); continue; }
    const S = Object.assign({}, SRC0);
    S[file] = SRC0[file].replace(find, () => repl);
    if (also) S[file] = also(S[file]);
    const res = await run(S, probes), red = probes.filter(p => res[p].F.length);
    if (red.length) caught++;
    say(red.length > 0, 'SELF-TEST "' + name + '" turns ' + probes.join(' / ') + ' red' + (red.length ? ': ' + res[red[0]].F[0] : ' - MISSED'));
  }
  say(shaOf(readAll()) === SHA0, 'SELF-TEST the sources are byte-identical after ' + MUT.length + ' mutations (' + SHA0.slice(0, 12) + ')');
  say(caught === MUT.length, 'SELF-TEST ' + caught + ' / ' + MUT.length + ' mutations caught');
  console.log('GATE MIXLEAD: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
