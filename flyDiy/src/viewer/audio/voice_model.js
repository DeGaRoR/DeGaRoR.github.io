// ============================================================
// RADIO JOLENE'S VOICE - THE WORDS (G1626-G1627, SND-VOICE; SOUND-2026-10-04 ruling s12).
// window.VOICE_MODEL (and module.exports in node): PURE - no Web Audio, no fetch, no clock.
//
// The station speaks in RECORDED clips: a neural voice (Piper, MIT, a voice trained from scratch on public-domain
// / CC-BY recordings - the table in reports/evidence/SND-VOICE/README.md) rendered OFFLINE by
// tools/audio/prep_voice.js into media/audio/voice/, catalogued in src/viewer/audio/voice_catalogue.json (inlined
// by the build as window.FLYDIY_VOICE). Every machine hears the same voice, offline, with no runtime TTS.
//
//   THE VOCABULARY  VOCAB below: key -> the words the clip says (what prep_voice.js renders). Two families:
//                   the AWOS words (how real automated stations talk: words and digits concatenated), and the
//                   marine forecast's. A digit / a number word has a CONTINUING take (rendered "seven,", the
//                   voice holds up) and a FINAL take ('.f', rendered "seven.", the voice falls) - the assembler
//                   uses the final take at the end of each group, which is most of what makes a concatenated
//                   reading sound read and not stitched.
//   THE ASSEMBLERS  awosClips(obs), marineClips(fc), backAnnounce(track, frame) -> a SEQUENCE: clip keys (strings)
//                   and rests (numbers, seconds). AUDIO_VOICE.play(seq) schedules it gap-free.
//   THE LINES       the station's script (IDs, bulletins, pilot notes, swap corner) is DATA in
//                   tools/audio/voice_script.json; its keys reach the game through the catalogue only.
//
// awosClips(obs) - obs, a METAR-shaped observation:
//   { timeZ: '1753' | minutes-of-day (number), wind: { dirDeg: 0..360 | null (variable), kt, gustKt? },
//     visSM: statute miles (>= 10 reads "one zero"; < 1 reads quarters), wx: ['light_rain', ...] (WX keys),
//     sky: [{ cover: 'FEW'|'SCT'|'BKN'|'OVC', ft: AGL }] (empty: sky clear below one two thousand),
//     tempC, dewC, altInHg | qnhPa (one of them), rmk: [REMARK keys] }
//   Reading (the US AWOS order): station, time zulu | wind (calm under 3 kt; dir to 10 deg; gusts) | visibility,
//   weather | sky (the first BKN/OVC layer is the ceiling) | temperature, dew point (minus) | altimeter | remarks.
// ============================================================
var VOICE_MODEL = (function () {
  'use strict';
  const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
  // the rests (seconds): between words inside a group, between groups, between sentences
  const REST = { word: 0.05, group: 0.28, sentence: 0.55 };

  const VOCAB = {};
  // digits and the height words: a continuing and a final take each
  DIG.forEach((w, i) => { VOCAB['d.' + i] = w + ','; VOCAB['d.' + i + '.f'] = w + '.'; });
  for (const w of ['thousand', 'hundred']) { VOCAB['w.' + w] = w + ','; VOCAB['w.' + w + '.f'] = w + '.'; }
  Object.assign(VOCAB, {
    'awos.intro': 'Jolene field automated weather observation.',
    'w.zulu': 'zulu.',
    'w.wind': 'wind,', 'w.calm': 'calm.', 'w.variable': 'variable,', 'w.at': 'at,', 'w.gusts': 'gusts,',
    'w.visibility': 'visibility,', 'w.less_than': 'less than,', 'w.one_quarter': 'one quarter.',
    'w.one_half': 'one half.', 'w.three_quarters': 'three quarters.',
    'w.sky_condition': 'sky condition,', 'w.ceiling': 'ceiling,', 'w.few': 'few clouds,', 'w.scattered': 'scattered,',
    'w.broken': 'broken.', 'w.overcast': 'overcast.', 'w.sky_clear': 'sky clear below one two thousand.',
    'w.temperature': 'temperature,', 'w.dew_point': 'dew point,', 'w.minus': 'minus,',
    'w.altimeter': 'altimeter,', 'w.remarks': 'remarks,',
    // present weather (after the visibility) - WX keys
    'wx.light_rain': 'light rain.', 'wx.rain': 'rain.', 'wx.heavy_rain': 'heavy rain.', 'wx.drizzle': 'drizzle.',
    'wx.light_snow': 'light snow.', 'wx.snow': 'snow.', 'wx.fog': 'fog.', 'wx.mist': 'mist.', 'wx.haze': 'haze.',
    'wx.showers': 'showers in the vicinity.', 'wx.thunderstorm': 'thunderstorm in the vicinity.',
    // remarks - REMARK keys
    'rmk.birds': 'bird activity in the vicinity of the airport.', 'rmk.wind_shear': 'wind shear reported.',
    'rmk.density': 'check density altitude.', 'rmk.runway_wet': 'runway one three wet.',
    'rmk.light_rain': 'light rain.',
    // the marine forecast
    'mar.intro': 'And the marine forecast for the Sound.', 'mar.advisory': 'Small craft advisory in effect.',
    'mar.wind': 'wind,', 'mar.to': 'to,', 'mar.knots': 'knots.', 'mar.seas': 'seas,', 'mar.feet': 'feet.', 'mar.foot': 'foot.',
    'mar.less_than': 'less than,', 'mar.variable': 'variable', 'mar.rising': 'rising.', 'mar.easing': 'easing.',
    'mar.fair': 'Fair.', 'mar.fog': 'Patchy fog.', 'mar.rain': 'Rain at times.', 'mar.showers': 'Scattered showers.',
    'mar.this_morning': 'this morning.', 'mar.this_afternoon': 'this afternoon.', 'mar.tonight': 'tonight.',
    'mar.tomorrow': 'tomorrow.', 'mar.becoming': 'becoming,',
  });
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  for (const c of COMPASS) VOCAB['mar.' + c] = c;
  // the marine numbers: words, to 50 by the fives above 12
  const NUMW = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
    11: 'eleven', 12: 'twelve', 15: 'fifteen', 20: 'twenty', 25: 'twenty five', 30: 'thirty', 35: 'thirty five',
    40: 'forty', 45: 'forty five', 50: 'fifty' };
  for (const n in NUMW) VOCAB['n.' + n] = NUMW[n];
  // the back-announce frames (the per-track clips are catalogue keys: 'ba.<track id>', 'title.<id>', 'artist.<slug>')
  Object.assign(VOCAB, { 'ba.that_was': 'That was', 'ba.by': 'by', 'ba.before_that': 'Before that,',
    'ba.coming_up': 'Coming up,', 'ba.here_is': "Here's", 'ba.on_radio_jolene': 'on Radio Jolene.' });

  const WX = ['light_rain', 'rain', 'heavy_rain', 'drizzle', 'light_snow', 'snow', 'fog', 'mist', 'haze', 'showers', 'thunderstorm'];
  const REMARKS = ['birds', 'wind_shear', 'density', 'runway_wet', 'light_rain'];

  // a digit string, each digit a clip; the last one the final take when `fin`
  function digits(s, fin) { const a = []; for (let i = 0; i < s.length; i++) a.push('d.' + s[i] + (fin && i === s.length - 1 ? '.f' : '')); return a; }
  // a height in feet the way it is said on the air: 800 "eight hundred", 1200 "one thousand two hundred",
  // 12000 "one two thousand", 2500 "two thousand five hundred"; rounded to 100 ft (to 500 above 5000, as reported)
  function height(ft, fin) {
    ft = Math.max(100, Math.round(ft / (ft > 5000 ? 500 : 100)) * (ft > 5000 ? 500 : 100));
    const th = Math.floor(ft / 1000), hu = Math.round((ft - th * 1000) / 100), a = [];
    if (th) { a.push(...digits(String(th), false), 'w.thousand' + (fin && !hu ? '.f' : '')); }
    if (hu) { a.push('d.' + hu, 'w.hundred' + (fin ? '.f' : '')); }
    return a;
  }
  // a signed temperature, digits, minus spoken; -0 reads "zero"
  function temp(c) { const r = Math.round(c), a = []; if (r < 0) a.push('w.minus'); a.push(...digits(String(Math.abs(r)), true)); return a; }
  function hhmm(t) {
    if (typeof t === 'number') { const m = ((Math.round(t) % 1440) + 1440) % 1440; t = String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0'); }
    t = String(t).replace(/\D/g, ''); return t.padStart(4, '0').slice(-4);
  }
  // join groups with word rests inside and a group rest between; a group is an array of keys
  function seq(groups) {
    const out = [];
    groups.forEach((g, gi) => {
      if (!g || !g.length) return;
      if (out.length) out.push(typeof g.rest === 'number' ? g.rest : REST.group);
      g.forEach((k, i) => { if (i) out.push(REST.word); out.push(k); });
    });
    return out;
  }
  const S = (a, rest) => { a.rest = rest; return a; };   // a group that opens a sentence (the longer rest)

  function awosClips(obs) {
    const o = obs || {}, G = [];
    G.push(['awos.intro']);
    G.push(S([...digits(hhmm(o.timeZ != null ? o.timeZ : 0), false), 'w.zulu'], REST.group));
    // wind
    const w = o.wind || {}, kt = Math.round(+w.kt || 0);
    if (kt < 3) G.push(S(['w.wind', 'w.calm'], REST.sentence));
    else {
      const g = ['w.wind'];
      if (w.dirDeg == null || !isFinite(w.dirDeg)) g.push('w.variable');
      else { let d = Math.round((((+w.dirDeg % 360) + 360) % 360) / 10) * 10; if (d === 0) d = 360; g.push(...digits(String(d).padStart(3, '0'), false)); }
      const gu = Math.round(+w.gustKt || 0), hasG = gu >= kt + 3;   // a gust is reported 3 kt (METAR: 10) above the mean
      g.push('w.at', ...digits(String(kt), !hasG));
      G.push(S(g, REST.sentence));
      if (hasG) G.push(['w.gusts', ...digits(String(gu), true)]);
    }
    // visibility, then the weather
    const v = +o.visSM, vg = ['w.visibility'];
    if (!(v >= 0) || v >= 10) vg.push('d.1', 'd.0.f');
    else if (v >= 1) vg.push('d.' + Math.floor(v) + '.f');
    else if (v >= 0.75) vg.push('w.three_quarters');
    else if (v >= 0.5) vg.push('w.one_half');
    else if (v >= 0.25) vg.push('w.one_quarter');
    else vg.push('w.less_than', 'w.one_quarter');
    G.push(S(vg, REST.sentence));
    for (const x of o.wx || []) if (WX.includes(x)) G.push(['wx.' + x]);
    // the sky: the first broken / overcast layer is the ceiling
    const sky = (o.sky || []).filter(l => l && /^(FEW|SCT|BKN|OVC)$/.test(l.cover) && l.ft >= 0 && l.ft < 12000).sort((a, b) => a.ft - b.ft);
    if (!sky.length) G.push(S(['w.sky_clear'], REST.sentence));
    else {
      let ceil = false;
      sky.forEach((l, i) => {
        const g = [];
        if (l.cover === 'FEW' || l.cover === 'SCT') g.push(l.cover === 'FEW' ? 'w.few' : 'w.scattered', ...height(l.ft, true));
        else { if (!ceil) g.push('w.ceiling'); ceil = true; g.push(...height(l.ft, false), l.cover === 'BKN' ? 'w.broken' : 'w.overcast'); }
        G.push(i ? g : S(g, REST.sentence));
      });
    }
    // temperature, dew point
    if (o.tempC != null && isFinite(o.tempC)) G.push(S(['w.temperature', ...temp(o.tempC)], REST.sentence));
    if (o.dewC != null && isFinite(o.dewC)) G.push(['w.dew_point', ...temp(o.dewC)]);
    // the altimeter, in inches: four digits
    let alt = o.altInHg != null ? +o.altInHg : o.qnhPa != null ? +o.qnhPa / 3386.389 : NaN;
    if (isFinite(alt)) G.push(S(['w.altimeter', ...digits(String(Math.round(alt * 100)).padStart(4, '0').slice(-4), true)], REST.sentence));
    const rm = (o.rmk || []).filter(r => REMARKS.includes(r));
    if (rm.length) { G.push(S(['w.remarks'], REST.sentence)); for (const r of rm) G.push(['rmk.' + r]); }
    return seq(G);
  }

  // a number for the marine reading: the nearest word we have
  function num(n) {
    n = Math.max(1, Math.round(n));
    if (n <= 12) return 'n.' + n;
    const r = Math.min(50, Math.round(n / 5) * 5); return 'n.' + r;
  }
  // marineClips(fc): { dirDeg | null, kt: [lo, hi] | kt, seasFt, sky: 'fair'|'fog'|'rain'|'showers', when?: 'this_morning'|
  //   'this_afternoon'|'tonight'|'tomorrow', trend?: 'rising'|'easing', advisory?: bool }
  function marineClips(fc) {
    const f = fc || {}, G = [['mar.intro']];
    if (f.advisory) G.push(S(['mar.advisory'], REST.sentence));
    const k = Array.isArray(f.kt) ? f.kt : [f.kt, f.kt];
    let lo = Math.round(+k[0] || 0), hi = Math.round(+k[1] || lo);
    const g = [];
    if (f.dirDeg == null || !isFinite(f.dirDeg) || hi < 5) g.push('mar.variable');
    else g.push('mar.' + COMPASS[Math.round((((+f.dirDeg % 360) + 360) % 360) / 45) % 8]);
    g.push('mar.wind');
    if (hi < 5) g.push('mar.less_than', 'n.5', 'mar.knots');
    else { const a = num(lo), b = num(hi); g.push(a); if (b !== a) g.push('mar.to', b); g.push('mar.knots'); }
    G.push(S(g, REST.sentence));
    if (f.trend === 'rising' || f.trend === 'easing') G.push(['mar.' + f.trend]);
    if (f.seasFt != null && isFinite(f.seasFt)) {
      const s = +f.seasFt;
      if (s < 1) G.push(S(['mar.seas', 'mar.less_than', 'n.1', 'mar.foot'], REST.sentence));
      else { const n = num(s); G.push(S(['mar.seas', n, n === 'n.1' ? 'mar.foot' : 'mar.feet'], REST.sentence)); }
    }
    const sk = ['fair', 'fog', 'rain', 'showers'].includes(f.sky) ? f.sky : null;
    if (sk) G.push(S(['mar.' + sk], REST.sentence));
    if (sk && ['this_morning', 'this_afternoon', 'tonight', 'tomorrow'].includes(f.when)) G[G.length - 1].push('mar.' + f.when);
    return seq(G);
  }

  // the slug an artist's clip is keyed by
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  // backAnnounce(track, frame): frame 'that_was' (default) -> the track's own whole sentence 'ba.<id>' (one take,
  // natural prosody); 'before_that' / 'coming_up' / 'here_is' -> the frame, the title, 'by', the artist
  function backAnnounce(track, frame) {
    const t = track || {};
    if (!frame || frame === 'that_was') return ['ba.' + t.id];
    return seq([['ba.' + frame], ['title.' + t.id, 'ba.by', 'artist.' + slug(t.artist)]]);
  }
  // every key a track's back-announce can name
  const trackKeys = t => ['ba.' + t.id, 'title.' + t.id, 'artist.' + slug(t.artist)];

  // timeline(seq, durOf) -> { at: [{ key, t, dur }], total }: where each clip of a sequence starts, laid end to end
  // with the rests between (durOf(key) -> seconds, the catalogue's dur); AUDIO_VOICE.play schedules exactly this
  function timeline(seq, durOf) {
    const at = []; let t = 0;
    for (const s of seq || []) {
      if (typeof s === 'number') { if (s > 0 && isFinite(s)) t += s; continue; }
      const d = +durOf(s); if (!(d > 0)) continue;
      at.push({ key: s, t, dur: d }); t += d;
    }
    return { at, total: t };
  }

  return { VOCAB, REST, timeline, WX, REMARKS, COMPASS, awosClips, marineClips, backAnnounce, trackKeys, slug, height, hhmm };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VOICE_MODEL;
