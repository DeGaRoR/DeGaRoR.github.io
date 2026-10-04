// ============================================================
// RADIO JOLENE'S TALK (SND-RADIO G1675-G1679, SND-RADIO-2 G1683, SND-RADIO-3 G1700-G1704; SOUND-2026-10-04 §7, rulings
// s10-s13): window.RADIO_TALK - the community station's breaks: CHOSEN and SEQUENCED from a broadcast written offline,
// and the voice that plays them.
//
// THE USER'S VERDICT (2026-10-04, after Radio Jolene in norman's voice): the automated weather was "a series of numbers,
// badly linked", the stitched text "really messes up punctuation, giving it a real robotic feeling" - make it LIVE. So
// nothing here assembles words or reads a number any more (the AWOS, the marine forecast and their clip vocabulary are
// retired). tools/audio/radio_gen.js writes the broadcast for the ear (the bible: tools/audio/radio_bible.md - Norman, a
// recurring cast, the island's businesses, story threads that progress), tools/audio/prep_voice.js renders each item as
// one whole take, and this file only CHOOSES:
//
//   THE SCRIPT  media/audio/voice/radio_script.<h8>.json (FLYDIY_VOICE.script.file): items { key: { file, dur, text, v,
//               cat, part?, track? } }, segments, pools, program, threads. FETCHED LAZILY - load(env) asks ASSET_FETCH for
//               it only when music.js tunes Radio Jolene with a context (after the gesture); until it is in, no break is
//               owed. Its items become AUDIO_VOICE's clips.
//   THE PROGRAM the breaks in broadcast order, each a list of tokens: '@id' (a station ID / greeting: the part of the day's
//               or a generic one), '@ba' (the back-announce of the track just played: one of its phrasings), '@wx' (the
//               weather in words, from the game), or a segment (a community notice, an ad, a call-in, the officer's
//               recorded message, the interview - one whole take each, or the turns of one). The threads' steps sit in
//               the program in their order (a dog lost, sighted, home).
//   THE CURSOR  { v, k, n, h }: the next break of the program (k), the breaks heard (n), and when each pooled take was last
//               heard (h: key -> n). PERSISTED in localStorage flydiy.audio.radioCursor (try/catch: a throwing or empty
//               storage starts at the top) - a new session CONTINUES the broadcast instead of restarting it. The pools
//               choose the least recently heard take that fits (ties: the pool's order): no repeat until a pool is spent.
//   THE WEATHER IN WORDS readGame(world) reads the game's numbers (as SND-RADIO did: the climate's wind and gust, the
//               surface visibility, the day's cloud decks, temperature, humidity, the front) and conditions(wx)
//               QUANTISES them - never quoted: the part of the day, the sky (clear / fair / cloudy / grey / low / mist /
//               fog / rain), the wind band (calm / light / breezy / windy / gale) and gustiness, the hazards (fog for
//               pilots and boaters, a wind for both, soft gravel strips, frost, eagles on the field), the trend (a front
//               on the way, easing behind one), the feel (cold / mild). A weather segment is two or three whole
//               sentences chosen to match: the sky's, then the least recently heard of the wind's / the hazards' / the
//               outlook's / the feel's.
//   breakScript(cursor, wx, tracks, opt) -> the segments of the next break [{ kind, key, text, clips, items }]: the
//               tune-in (opt.tuneIn: a station ID and the weather; the cursor's program does not move), else the program's
//               next break. clips: the item keys with the rests between them (AUDIO_VOICE.play's sequence).
//   THE VOICE   makeTalker(env, getVoice): a segment's recorded takes when every key has one (AUDIO_VOICE, Web Audio, into
//               music.js's radio gain), else its text through makeSpeaker (speechSynthesis - only the fallback for a
//               missing take), else skipped.
// ============================================================
var RADIO_TALK = (function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const KT = 0.514444, FT = 0.3048, D2R = Math.PI / 180;
  const PREFERRED_VOICE = 'Microsoft George - English (United Kingdom)';
  // the user's bench settings (2026-10-04): rate 0.95, pitch 0.95 (the speechSynthesis fallback)
  const RATE = 0.95, PITCH = 0.95;
  // THE DECLARED NUMBERS (used only where the game holds none; each use is named in readGame's `.declared`)
  const DECL = { visM: 16093, oatC: 15, dewC: 5, cover: 0, baseM: 1500, stormWindK: 2.2, stormVeerDeg: 55 };
  // THE QUANTISING (declared): the wind bands in knots (the inside waters' small craft advisory 23 kt sits in 'windy',
  // the gale warning 34 kt opens 'gale'); a gusty day when the peaks and lulls differ by 10 kt or more (METAR's rule);
  // fog under 1 km, mist under 5 km; a deck that low (300 m, about 1000 ft) is 'low' cloud; cold at 3 C and under, mild
  // at 16 C and over, frost at 1 C and under; the gravel strips soft at 85 % humidity under cloud, or a front passing;
  // a front 'on the way' within 18 hours.
  const BANDS = [[4, 'calm'], [11, 'light'], [18, 'breezy'], [34, 'windy'], [Infinity, 'gale']];
  const GUST_SPREAD_KT = 10, FOG_M = 1000, MIST_M = 5000, LOW_M = 300, COLD_C = 3, MILD_C = 16, FROST_C = 1, SOFT_RH = 0.85, FRONT_S = 18 * 3600;
  // the rests (seconds) between the takes of one segment: the turns of a call or the interview, the weather's sentences
  const R_TURN = 0.4, R_SENT = 0.45;
  const CURSOR_KEY = 'flydiy.audio.radioCursor';

  const norm360 = d => ((d % 360) + 360) % 360;
  const coverClass = c => (c < 0.0625 ? '' : c < 0.3125 ? 'few' : c < 0.5625 ? 'scattered' : c < 0.9375 ? 'broken' : 'overcast');
  const partOfDay = sec => { const h = (sec / 3600) % 24; return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night'; };

  // ---- READING THE GAME ---------------------------------------------------------------------------------------------
  // world: AUDIO.world (day, climate, seaTarget); opt.sim: the page's sim (out.windX/Z when no climate)
  function readGame(W, opt) {
    opt = opt || {};
    const day = W && W.day, cl = W && W.climate, declared = [];
    const num = v => typeof v === 'number' && v === v;
    const geo = day && day.geo;
    const conv = geo && num(geo.convergenceDeg) ? geo.convergenceDeg : 0;
    // THE WIND: the climate's 10 m wind (grid: x east, z south) -> FROM, true (09_climate bearingToBase inverted)
    let spd = 0, dirT = 0, gust = 0, windFrom = 'climate';
    const sw = cl && cl.surfaceWind ? cl.surfaceWind() : null;
    const out = opt.sim && opt.sim.out;
    if (sw && sw.base) {
      const b = sw.base; spd = Math.hypot(b[0], b[2]);
      dirT = spd > 0.05 ? norm360(Math.atan2(-b[0], b[2]) / D2R + conv) : 0;
      gust = cl.spec && num(cl.spec.gust) ? cl.spec.gust : 0;
    } else if (out && num(out.windX)) {
      spd = Math.hypot(out.windX, out.windZ || 0); dirT = spd > 0.05 ? norm360(Math.atan2(-out.windX, out.windZ || 0) / D2R + conv) : 0;
      windFrom = 'sim'; declared.push('wind: no climate - the solver\'s wind at the aeroplane (out.windX/Z), gusts unknown');
    } else { windFrom = 'none'; declared.push('wind: no climate and no sim - calm'); }
    // THE VISIBILITY: the climate's surface visibility (Koschmieder, both media), else the day's column
    let visM;
    const hz = cl && cl.haze ? cl.haze() : null;
    if (hz && num(hz.surfaceVisM)) visM = hz.surfaceVisM;
    else if (day && num(day.visibilityKm)) { visM = day.visibilityKm * 1000; declared.push('visibility: the day\'s column (no climate haze)'); }
    else { visM = DECL.visM; declared.push('visibility: ' + DECL.visM + ' m (declared)'); }
    // THE SKY: the day's low deck (its base the LCL: above the surface) + the upper decks that name a base
    const layers = [];
    if (day) {
      const cov = num(day.cloudCoverEff) ? day.cloudCoverEff : num(day.cloudCover) ? day.cloudCover : 0;
      if (num(day.cloudBase)) layers.push({ cover: cov, baseM: day.cloudBase });
      else { layers.push({ cover: cov, baseM: DECL.baseM }); declared.push('cloud base: ' + DECL.baseM + ' m (declared)'); }
      for (const u of Array.isArray(day.cloudUpper) ? day.cloudUpper : []) if (u && num(u.base)) layers.push({ cover: u.cover || 0, baseM: u.base });
    } else declared.push('sky: no day - clear (declared)');
    layers.sort((a, b) => a.baseM - b.baseM);
    const oatC = day && num(day.oatC) ? day.oatC : (declared.push('temperature: ' + DECL.oatC + ' C (declared)'), DECL.oatC);
    const dewC = day && num(day.dewC) ? day.dewC : (declared.push('dew point: ' + DECL.dewC + ' C (declared)'), DECL.dewC);
    const utc = day && num(day.utc) ? day.utc : 0, local = day && num(day.localSeconds) ? day.localSeconds : utc;
    if (!day) declared.push('time: no day - midnight');
    const st = day && day.storm ? day.storm : null, ss = day && day.stormSpec ? day.stormSpec : null;
    return {
      windKt: spd / KT, windDirT: dirT, gust, windFrom, visM, layers, oatC, dewC, rh: day && num(day.rh) ? day.rh : null, utc, local,
      storm: st ? { I: st.I, phase: st.phase, inS: st.inS, kNow: num(st.windK) ? st.windK : 1, windK: ss && num(ss.windK) ? ss.windK : DECL.stormWindK,
                    veerDeg: ss && num(ss.veerDeg) ? ss.veerDeg : DECL.stormVeerDeg } : null,
      declared,
    };
  }

  // ---- THE CONDITIONS: the game's weather quantised (never quoted) ----------------------------------------------------
  function conditions(wx) {
    const part = partOfDay(wx.local), kt = wx.windKt, s = wx.storm;
    let wind = 'calm'; for (const [lim, b] of BANDS) if (kt < lim) { wind = b; break; }
    const gusty = kt * 2 * wx.gust >= GUST_SPREAD_KT && (wind === 'breezy' || wind === 'windy' || wind === 'gale');
    // the sky: the most cover of the decks under 3600 m, 'low' when a broken / overcast deck sits under LOW_M
    let cov = 0, low = false;
    for (const L of wx.layers) if (L.baseM < 3600) { if (L.cover > cov) cov = L.cover; if (L.baseM < LOW_M && L.cover >= 0.5625) low = true; }
    const cls = coverClass(cov);
    const rain = !!(s && s.phase === 'passage');
    const sky = rain ? 'rain' : wx.visM < FOG_M ? 'fog' : wx.visM < MIST_M ? 'mist' : low ? 'low' : cls === 'overcast' ? 'grey' : cls === 'broken' ? 'cloudy' : cls ? 'fair' : 'clear';
    const day = part === 'morning' || part === 'afternoon';
    const hazards = [];
    if (sky === 'fog') hazards.push('fogPilot', 'fogBoat');
    if (wind === 'windy' || wind === 'gale') hazards.push('windBoat', 'windPilot');
    if (rain || (s && s.phase === 'post') || (wx.rh != null && wx.rh >= SOFT_RH && cov >= 0.5625)) hazards.push('softStrip');
    if (wx.oatC <= FROST_C) hazards.push('frost');
    if (day && (wind === 'calm' || wind === 'light') && (sky === 'clear' || sky === 'fair' || sky === 'cloudy' || sky === 'grey')) hazards.push('eagles');
    const trend = s && (s.phase === 'none' || s.phase === 'pre') && s.inS > 0 && s.inS < FRONT_S ? 'front' : s && (s.phase === 'passage' || s.phase === 'post') ? 'easing' : null;
    const temp = wx.oatC <= COLD_C ? 'cold' : wx.oatC >= MILD_C ? 'mild' : null;
    return { part, tag: part === 'night' ? 'evening' : part, sky, wind, gusty, hazards, trend, temp };
  }

  // ---- THE SCRIPT (fetched lazily) -------------------------------------------------------------------------------------
  let SCRIPT = null, loading = null, loadState = 'idle';
  function setScript(s) { SCRIPT = s && s.items && s.program ? s : null; loadState = SCRIPT ? 'ready' : 'failed'; return !!SCRIPT; }
  const ready = () => !!SCRIPT;
  // fetch the shipped script (FLYDIY_VOICE.script.file through ASSET_FETCH) once; its items become AUDIO_VOICE's clips
  function load(env) {
    const E = env || G;
    if (SCRIPT) return Promise.resolve(true);
    if (loading) return loading;
    const c = E.FLYDIY_VOICE && E.FLYDIY_VOICE.script, f = E.ASSET_FETCH;
    if (!c || !c.file || typeof f !== 'function') { loadState = 'failed'; return Promise.resolve(false); }
    const base = typeof E.FLYDIY_ASSET_BASE === 'string' ? E.FLYDIY_ASSET_BASE : '';
    loadState = 'loading';
    loading = Promise.resolve().then(() => f(base + c.file)).then(u8 => {
      const txt = typeof u8 === 'string' ? u8 : typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(u8) : String.fromCharCode.apply(null, u8);
      const ok = setScript(JSON.parse(txt));
      const V = E.AUDIO_VOICE;
      if (ok && V && V.setClips) V.setClips(SCRIPT.items);
      return ok;
    }).catch(e => { loadState = 'failed'; if (E.console) E.console.warn('radio: the broadcast script did not load - ' + (e && e.message || e)); return false; });
    return loading;
  }

  // ---- THE CURSOR (persisted: a new session continues the broadcast) -------------------------------------------------
  const sigOf = s => (s ? s.seed + ':' + s.program.length + ':' + Object.keys(s.items).length : '');
  function cursor(env) {
    const E = env || G;
    let c = null;
    try { const t = E.localStorage && E.localStorage.getItem(CURSOR_KEY); c = t ? JSON.parse(t) : null; } catch (e) { c = null; }
    if (!c || typeof c !== 'object' || typeof c.k !== 'number' || !c.h || typeof c.h !== 'object') c = { v: '', k: 0, n: 0, h: {} };
    return c;
  }
  function saveCursor(c, env) {
    const E = env || G;
    try { if (E.localStorage) E.localStorage.setItem(CURSOR_KEY, JSON.stringify(c)); } catch (e) {}
  }
  // a cursor written for another script starts the new one at its top (its takes' history kept where the keys still exist)
  function fit(c) {
    const v = sigOf(SCRIPT);
    if (c.v !== v) { c.v = v; c.k = 0; for (const k in c.h) if (!SCRIPT.items[k]) delete c.h[k]; }
    if (!(c.k >= 0 && c.k < SCRIPT.program.length)) c.k = 0;
    c.n = c.n | 0;
  }
  // the least recently heard of the keys (never heard first; ties: the pool's order); marked heard now
  function pick(c, keys) {
    let best = null, bh = Infinity;
    for (const k of keys || []) { if (!SCRIPT.items[k]) continue; const h = c.h[k] != null ? c.h[k] : -1; if (h < bh) { bh = h; best = k; } }
    if (best) c.h[best] = c.n;
    return best;
  }
  const staleness = (c, keys) => { let m = Infinity; for (const k of keys || []) if (SCRIPT.items[k]) { const h = c.h[k] != null ? c.h[k] : -1; if (h < m) m = h; } return m; };

  // ---- THE SEGMENTS ----------------------------------------------------------------------------------------------------
  const textOf = keys => keys.map(k => SCRIPT.items[k].text).join(' ');
  function segOf(kind, key, keys, rest) {
    const clips = [];
    keys.forEach((k, i) => { if (i) clips.push(rest); clips.push(k); });
    return { kind, key, text: textOf(keys), clips, items: keys.slice() };
  }
  function idSeg(c, wx) {
    const P = SCRIPT.pools.id, part = partOfDay(wx.local);
    // alternate the part of the day's greeting and a generic ID, whichever was heard longer ago
    const useGen = staleness(c, P.generic) <= staleness(c, P[part]);
    const k = pick(c, useGen ? P.generic : P[part]) || pick(c, P.generic);
    return k ? segOf('id', 'id', [k], R_SENT) : null;
  }
  function backSeg(c, track) {
    if (!track || !track.title) return null;
    const keys = track.id && SCRIPT.pools.ba[track.id];
    const k = keys && pick(c, keys);
    if (k) return segOf('back', 'back', [k], R_SENT);
    // a track the broadcast was not written for (a new catalogue entry before the re-render): spoken
    return { kind: 'back', key: 'back', text: 'That was ' + String(track.title).replace(/"/g, '') + ', by ' + track.artist + '.', clips: null, items: [] };
  }
  function wxSeg(c, wx) {
    const P = SCRIPT.pools.wx, k = conditions(wx);
    const leads = (P.lead[k.sky] || []).filter(x => { const p = SCRIPT.items[x] && SCRIPT.items[x].part; return !p || p === k.tag; });
    const out = [];
    const lead = pick(c, leads); if (lead) out.push(lead);
    // then the least recently heard of what else fits - the wind band's, the gusts', the eagles', the outlook's, the
    // feel's - and, on a day with a real hazard (fog, a strong wind, soft strips, frost), the least recently heard of
    // its advice: two sentences, or three
    const extras = [P.wind[k.wind]];
    if (k.gusty) extras.push(P.gusty);
    if (k.hazards.indexOf('eagles') >= 0) extras.push(P.advice.eagles);
    if (k.trend) extras.push(P.outlook[k.trend]);
    if (k.temp) extras.push(P.feel[k.temp]);
    const stalest = list => { let best = null, bs = Infinity; for (const e of list) if (e && e.length) { const st = staleness(c, e); if (st < bs) { bs = st; best = e; } } return best; };
    const e1 = stalest(extras); if (e1) { const x = pick(c, e1); if (x) out.push(x); }
    const e2 = stalest(k.hazards.filter(h => h !== 'eagles').map(h => P.advice[h])); if (e2) { const x = pick(c, e2); if (x) out.push(x); }
    return out.length ? segOf('wx', 'wx', out, R_SENT) : null;
  }
  // the next break: tuning in = an ID and the weather (the program does not move); else the program's next break
  function breakScript(c, wx, tracks, opt) {
    if (!SCRIPT) return [];
    fit(c);
    const S = [];
    if (opt && opt.tuneIn) {
      const a = idSeg(c, wx), b = wxSeg(c, wx);
      if (a) S.push(a); if (b) S.push(b);
      c.n++;
      return S;
    }
    const prog = SCRIPT.program[c.k], tr = (tracks || []).filter(Boolean)[0];
    for (const t of prog) {
      let x = null;
      if (t === '@id') x = idSeg(c, wx);
      else if (t === '@ba') x = backSeg(c, tr);
      else if (t === '@wx') x = wxSeg(c, wx);
      else if (SCRIPT.segments[t]) { const sg = SCRIPT.segments[t]; x = segOf(sg.cat, t, sg.items, /call|interview|officer/.test(sg.cat) ? R_TURN : R_SENT); if (sg.th) { x.th = sg.th; x.st = sg.st; } }
      if (x) S.push(x);
    }
    c.k = (c.k + 1) % SCRIPT.program.length;
    c.n++;
    return S;
  }
  // the seconds a break should take at a rate (the watchdog's estimate for the spoken fallback)
  const estSeconds = (segs, rate) => segs.reduce((s, x) => s + x.text.length, 0) / 14 / (rate || 1) + 0.6 * segs.length;
  const VMOD = () => G.VOICE_MODEL || (typeof VOICE_MODEL !== 'undefined' ? VOICE_MODEL : null);

  // ---- THE VOICE (speechSynthesis) ------------------------------------------------------------------------------------
  function makeSpeaker(env) {
    const E = env || G;
    let live = 0, gen = 0, onDone = null;
    const synth = () => E.speechSynthesis || null;
    const available = () => !!(synth() && E.SpeechSynthesisUtterance);
    function voices() { try { return (synth() && synth().getVoices()) || []; } catch (e) { return []; } }
    function pickVoice(name) {
      const v = voices();
      return v.find(x => name && x.name === name) || v.find(x => x.name === PREFERRED_VOICE) ||
        v.find(x => /^en[-_]GB/i.test(x.lang || '')) || v.find(x => /^en/i.test(x.lang || '')) || null;
    }
    function finish() { if (!live) return; live = 0; gen++; const f = onDone; onDone = null; if (f) f(); }
    // speak the segments; done() once when the last ends (or on cancel). false when there is no voice to speak with
    function speak(segs, o, done) {
      cancel(true);
      const S = synth();
      if (!S || !E.SpeechSynthesisUtterance || !segs.length) return false;
      const my = ++gen, v = pickVoice(o && o.voice);
      let left = segs.length;
      onDone = done || null; live = 1;
      for (const s of segs) {
        const u = new E.SpeechSynthesisUtterance(s.text);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
        u.rate = o && o.rate || RATE; u.pitch = o && o.pitch || PITCH; u.volume = o && o.volume != null ? o.volume : 1;
        u.onend = u.onerror = () => { if (my === gen && --left <= 0) finish(); };
        try { S.speak(u); } catch (e) { cancel(true); return false; }
      }
      return true;
    }
    // stop now; done() runs unless silent
    function cancel(silent) {
      if (!live) return;
      const f = onDone; live = 0; gen++; onDone = null;
      try { synth().cancel(); } catch (e) {}
      if (!silent && f) f();
    }
    return { speak, cancel, voices, pickVoice, available, get speaking() { return live === 1; } };
  }

  // ---- THE TALKER (G1683, SND-RADIO-2): a break played segment by segment - a segment's recorded CLIPS when every key
  // has one (getVoice() -> AUDIO_VOICE: Web Audio, into o.dest - music.js's radio gain, so the music's ducks and the
  // context's suspend reach it), else its TEXT through makeSpeaker (speechSynthesis), else (no speech either) it is
  // skipped. Consecutive clip segments are ONE sequence (sample-exact, SEG_REST between them); consecutive spoken ones
  // are queued together. The same face as makeSpeaker - speak(segs, o, done) (done once: the last group's end, or a
  // cancel), cancel(silent), available(), speaking, voices(), pickVoice() - plus plan(segs) -> [{ clips, segs }],
  // seconds(segs, rate) (the watchdog's estimate: the clips' own length, the text's for speech) and `last` (what the
  // last break did, for the gate and the evidence). A cancelled break's late ends are ignored (a generation counter).
  const SEG_REST = 0.7;
  function makeTalker(env, getVoice) {
    const E = env || G, sp = makeSpeaker(E);
    const V = () => (getVoice ? getVoice() : null);
    let live = 0, gen = 0, onDone = null, handle = null, last = null;
    const resolves = x => { const v = V(); return !!(v && x.clips && x.clips.length && !v.missing(x.clips).length); };
    function plan(segs) {
      const groups = [];
      for (const x of segs) {
        const c = resolves(x), g = groups[groups.length - 1];
        if (g && g.clips === c) g.segs.push(x); else groups.push({ clips: c, segs: [x] });
      }
      return groups;
    }
    const seqOf = segs => { const o = []; for (const x of segs) { if (o.length) o.push(SEG_REST); for (const k of x.clips) o.push(k); } return o; };
    function seconds(segs, rate) {
      const v = V(), M = VMOD();
      return plan(segs).reduce((t, g) => t + SEG_REST + (g.clips && M ? M.timeline(seqOf(g.segs), k => v.dur(k)).total : estSeconds(g.segs, rate)), 0);
    }
    function finish() { if (!live) return; live = 0; gen++; handle = null; const f = onDone; onDone = null; if (f) f(); }
    function speak(segs, o, done) {
      cancel(true);
      if (!segs || !segs.length) return false;
      const groups = plan(segs);
      if (!groups.some(g => g.clips) && !sp.available()) return false;
      const my = ++gen, oo = o || {};
      live = 1; onDone = done || null;
      last = { groups: groups.map(g => ({ clips: g.clips, kinds: g.segs.map(x => x.kind) })), played: 0, spoken: 0, skipped: 0 };
      const L = last;
      let i = 0;
      const say = g => {   // a spoken group (the fallback); none possible -> skipped
        if (sp.available() && sp.speak(g.segs, oo, () => { if (my === gen) next(); })) { L.spoken += g.segs.length; return; }
        L.skipped += g.segs.length; next();
      };
      function next() {
        if (my !== gen) return;
        if (i >= groups.length) { finish(); return; }
        const g = groups[i++];
        if (!g.clips) { say(g); return; }
        const r = V().play(seqOf(g.segs), { dest: oo.dest, gain: oo.gain, onend: () => { if (my === gen) next(); } });
        Promise.resolve(r).then(h => {
          if (my !== gen) { if (h) h.stop(); return; }
          if (!h) { say(g); return; }   // nothing playable (no context, every clip failed): the voice reads it
          handle = h; L.played += g.segs.length;
        }, () => { if (my === gen) say(g); });
      }
      next();
      return true;
    }
    function cancel(silent) {
      if (!live) return;
      const f = onDone, h = handle; live = 0; gen++; onDone = null; handle = null;
      if (h) { try { h.stop(); } catch (e) {} }
      sp.cancel(true);
      if (!silent && f) f();
    }
    return { speak, cancel, plan, seconds, voices: sp.voices, pickVoice: sp.pickVoice,
      available: () => sp.available() || !!V(), get speaking() { return live === 1; }, get last() { return last; } };
  }

  const api = {
    DECL, RATE, PITCH, PREFERRED_VOICE, BANDS, GUST_SPREAD_KT, FOG_M, MIST_M, LOW_M, CURSOR_KEY, R_TURN, R_SENT, SEG_REST,
    readGame, conditions, partOfDay, coverClass, load, setScript, ready, get script() { return SCRIPT; }, get loadState() { return loadState; },
    cursor, saveCursor, breakScript, estSeconds, makeSpeaker, makeTalker,
  };
  return api;
})();
if (typeof window !== 'undefined') window.RADIO_TALK = RADIO_TALK;
if (typeof module !== 'undefined' && module.exports) module.exports = RADIO_TALK;
