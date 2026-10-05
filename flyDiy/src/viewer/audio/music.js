// ============================================================
// THE MUSIC (SND-MUSIC G1670-G1674, SOUND-2026-10-04 §2.4 / §7.2 / §7.3, rulings s4 / s6 / s9): window.AUDIO_MUSIC,
// the playlist player, registered as AUDIO.addSource('music', ...) on the 'music' bus.
//
//   STREAMED, NEVER DECODED WHOLE (§2.4, s4)  each track plays through an <audio> element ->
//             MediaElementAudioSourceNode: the browser's media pipeline buffers a few seconds of compressed bytes
//             (a 3-minute track decoded to PCM would be ~69 MB). TWO elements at most, made on the context (the
//             gesture), preload 'none' until a track is asked of them; one streams at a time except for the
//             seconds of a crossfade (and its LEAD_S of preload). A finished or faded element is emptied (src
//             removed, load()) so its buffer and its connection go.
//   THE CONTEXTS  WELCOME   the first boot's loading screen once the gesture exists (AUDIO.welcome). Decided: the
//                           music MAY start during the load - one element streaming ~16 KB/s and the media
//                           thread's decode are noise next to the load's own fetches and compiles; nothing is
//                           fetched or made before the gesture, nothing is decoded on the main thread.
//                 GARAGE    the shed (AUDIO.inGarage), with SILENCE GAPS of GAP_MIN_S..GAP_MAX_S between tracks
//                           (silence is part of calm); the setting 'music in the garage' (OFF by default since 2026-10-04) - it also covers
//                           the welcome.
//                 CRUISE    in flight ONLY with 'music in flight' on (s6: off by default), and then only in a
//                           cruise: off the ground, AGL >= CRUISE.enterAgl held CRUISE.dwellS, flaps up, not
//                           descending low (the approach); left at once below CRUISE.exitAgl, flaps out, a
//                           descent under CRUISE.approachAgl, or a wheel down (the parameter block: onGround,
//                           agl, V, vs, flap).
//                 PHOTO     the hook for the CELEBRATION photo mode: AUDIO_MUSIC.setPhoto(on) or
//                           AUDIO.emit('photo', on). (A photo mode that sets FLYDIY_HELD silences ALL sound -
//                           audio.js's pause - so it must not, if it wants its music.)
//             A context with no track tagged for it borrows FALLBACK's (welcome and photo -> garage; cruise never).
//   SHUFFLE   per context a bag: every track once before any repeats; a new round never opens on the track that
//             closed the last one. Seeded xorshift (AUDIO_MUSIC.seed(n)), so the gate replays.
//   CROSSFADE XFADE_S = 4 s EQUAL-POWER between the two elements (gains trim x sin / trim x cos of the same phase:
//             the power sum is constant), on setValueCurveAtTime with the curve computed once (a fade out of a
//             gain caught mid-fade starts from where it is). Welcome / cruise / photo crossfade track to track;
//             the garage lets a track end, waits its gap, then starts the next at full level.
//   LEAVING A CONTEXT  the playing track fades out over XFADE_S (crossfading into the new context's first track
//             if it has one) unless the track is tagged for the new context too - then it simply plays on (the
//             welcome's track carries into the shed). Where it stopped is kept per context (RESUME_S) and the
//             next visit resumes it.
//   DUCKING   -10 dB (DUCK_K) for DUCK_HOLD_S under an event: AUDIO.emit('engine', 'start' | 'catch')
//             (src_engine.js), 'stall' (SND-AIRFRAME's warning, when it lands), or any source's 'duck'; attack tau
//             DUCK_IN_TAU, release tau DUCK_OUT_TAU; a second event re-arms the hold.
//   THE LEVEL  catalogue lufs -> trim to LUFS_TARGET (-16 LUFS, the prep tool's target: a residual), clamped.
//   SUSPEND   AUDIO's 'suspend' (hidden / paused / unfocused) pauses the playing elements, 'resume' plays them.
//   THE FRAME update(P, dt, A) reads the block and typed slots, schedules nothing in a steady frame and
//             ALLOCATES NOTHING (the element clocks arrive by 'timeupdate' into a Float64Array; a track start,
//             a fade, a duck are events, not frames). GATE AUDIO measures it.
//
// THE CATALOGUE (src/viewer/audio/music_catalogue.json, written by the coordinator's prep tool from the user's
// picks; the build inlines it as window.FLYDIY_MUSIC - a manifest, not a media file: under media/ an unhashed
// JSON would be held forever by sw.js's cache-first rule, and GATE MEDIA would call it an orphan):
//   [{ id, file, title, artist, album, licence, source, contexts: ['garage','welcome','cruise','photo'],
//      lufs, durationS, credit? }]
//   file    'media/audio/music/<stem>.<h8>.mp3' - written through tools/_media_lib.js writeMedia('audio/music',
//           ...), content-versioned, so sw.js's /media/ rule caches it for good; resolved against
//           FLYDIY_ASSET_BASE like every baked manifest's paths (_media_lib BASE_DECL)
//   licence 'CC0' | 'CC0 1.0' | 'CC-BY 3.0' | 'CC-BY 4.0' | 'Public domain' (s3)   source  the track's page URL
//   credit  the exact attribution line a CC-BY artist asks for (Scott Buckley's), else one is composed
//   AUDIO_MUSIC.validate(cat) lists what is wrong with one.
//
// THE CREDITS (s9: by construction): the credits screen lists every catalogue track (creditRows) and the sound's
// origins (SOUND_CREDITS: the engine synth); a "music & sound" button is added to the shed's about line #credit
// (body.html, where the CC-BY model credits are). CREDITS.md's music list is generated from the same catalogue
// (tools/audio/music_credits.js); GATE AUDIO holds both equal to it.
// THE NOW-PLAYING LINE: "title — artist · licence" for NOW_S at a track's start in the garage, bottom-left of
// the workshop view (#musicNow, made here; no hot file carries it). The sound menu gains 'skip track' and a
// 'music credits' row (AUDIO.addRows).
// ============================================================
var AUDIO_MUSIC = (function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const CTX_NAMES = ['welcome', 'garage', 'cruise', 'photo'];
  const C_NONE = -1, C_WELCOME = 0, C_GARAGE = 1, C_CRUISE = 2, C_PHOTO = 3;
  const FALLBACK = [C_GARAGE, -1, -1, C_GARAGE];   // welcome / photo with no track of their own borrow the garage's
  const GAPPED = [0, 1, 0, 0];                       // the garage waits between tracks
  const XFADE_S = 4, LEAD_S = 3, GAP_MIN_S = 30, GAP_MAX_S = 120, RETRY_S = 2, RESUME_S = 20, NOW_S = 6;
  const DUCK_K = Math.pow(10, -10 / 20), DUCK_HOLD_S = 6, DUCK_IN_TAU = 0.12, DUCK_OUT_TAU = 0.8;
  const LUFS_TARGET = -16, TRIM_MIN = 0.25, TRIM_MAX = 2;
  const CRUISE = { enterAgl: 200, exitAgl: 120, dwellS: 20, minV: 15, flapMax: 0.05, approachVs: -2.5, approachAgl: 450 };
  const XF_N = 64;
  const CURVE_IN = new Float32Array(XF_N), CURVE_OUT = new Float32Array(XF_N);
  for (let i = 0; i < XF_N; i++) { const x = i / (XF_N - 1) * Math.PI / 2; CURVE_IN[i] = Math.sin(x); CURVE_OUT[i] = Math.cos(x); }
  CURVE_IN[0] = 0; CURVE_OUT[XF_N - 1] = 0;   // (cos(pi/2) is 6e-17: the ends are exact)
  const LICENCE_RE = /^(CC0( 1\.0)?|CC-BY [34]\.0|Public domain)$/i;
  const FILE_RE = /^media\/audio\/music\/[A-Za-z0-9_-]+\.[0-9a-f]{8}\.(mp3|ogg|opus|m4a|webm)$/;
  // the sound's origins on the credits screen (CREDITS.md's Sound section carries each in full; GATE AUDIO checks)
  const SOUND_CREDITS = [
    { what: 'The engine synthesiser', key: 'Antonio-R1',
      line: 'engine-sound-generator by Antonio-R1 (MIT, © 2021-2022 Antonio-R1), the AudioWorklet our engine voice is ported from',
      url: 'https://github.com/Antonio-R1/engine-sound-generator' },
    { what: '', key: 'DasEtwas',
      line: 'enginesound by DasEtwas (MIT, © 2020 DasEtwas), the reference implementation it follows',
      url: 'https://github.com/DasEtwas/enginesound' },
    { what: '', key: 'Baldan',
      line: 'after S. Baldan, S. Delle Monache et al., "Physically informed car engine sound synthesis for virtual and augmented environments", SIVE / IEEE VR 2015',
      url: '' },
  ];

  // ---- PURE: the catalogue ---------------------------------------------------------------------------------
  function validate(cat, opt) {
    const F = [], ids = new Set(), fileRe = (opt && opt.fileRe) || FILE_RE;
    if (!Array.isArray(cat)) return ['the catalogue is not an array'];
    cat.forEach((t, i) => {
      const at = 'track ' + i + (t && t.id ? ' (' + t.id + ')' : '') + ': ';
      if (!t || typeof t !== 'object') { F.push(at + 'not an object'); return; }
      if (typeof t.id !== 'string' || !/^[a-z0-9_-]+$/i.test(t.id)) F.push(at + 'id must be a word');
      else if (ids.has(t.id)) F.push(at + 'id repeated'); else ids.add(t.id);
      if (typeof t.file !== 'string' || !fileRe.test(t.file)) F.push(at + 'file ' + t.file + ' is not a content-versioned media/audio/music path');
      for (const k of ['title', 'artist', 'source']) if (typeof t[k] !== 'string' || !t[k]) F.push(at + k + ' missing');
      if (t.album != null && typeof t.album !== 'string') F.push(at + 'album must be a string');
      if (typeof t.licence !== 'string' || !LICENCE_RE.test(t.licence)) F.push(at + 'licence ' + t.licence + ' is not CC0 / CC-BY / public domain (s3)');
      if (/^CC-BY/i.test(t.licence || '') && !t.credit && !(t.artist && t.title)) F.push(at + 'CC-BY needs its credit');
      if (!Array.isArray(t.contexts) || !t.contexts.length || t.contexts.some(c => CTX_NAMES.indexOf(c) < 0)) F.push(at + 'contexts must be some of ' + CTX_NAMES.join(', '));
      if (!(t.durationS > 0)) F.push(at + 'durationS must be > 0');
      if (t.lufs != null && !(typeof t.lufs === 'number' && t.lufs < 0 && t.lufs > -60)) F.push(at + 'lufs ' + t.lufs + ' out of range');
    });
    return F;
  }
  // per context, the catalogue indices that may play there (FALLBACK when a context has none of its own)
  function contextLists(cat) {
    const L = CTX_NAMES.map(n => cat.map((t, i) => (t.contexts.indexOf(n) >= 0 ? i : -1)).filter(i => i >= 0));
    return L.map((l, c) => (l.length || FALLBACK[c] < 0 ? l : L[FALLBACK[c]].slice()));
  }
  const trimOf = t => (typeof t.lufs === 'number' ? Math.max(TRIM_MIN, Math.min(TRIM_MAX, Math.pow(10, (LUFS_TARGET - t.lufs) / 20))) : 1);
  const creditLine = t => t.credit || ('"' + t.title + '" by ' + t.artist + (t.album ? ' (' + t.album + ')' : '') + ' — ' + t.licence);
  function creditRows(cat) {
    return (Array.isArray(cat) ? cat : []).map(t => ({ id: t.id, title: t.title, artist: t.artist, album: t.album || '',
      licence: t.licence, source: t.source, line: creditLine(t) }));
  }
  const nowLine = t => t.title + ' — ' + t.artist + ' · ' + t.licence;

  // ---- PURE: the shuffle bag (every track once per round; a round never opens on the last one played) ---------
  const RNG = new Uint32Array(1); RNG[0] = 0x9e3779b9;
  function rand() { let x = RNG[0]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; RNG[0] = x; return (RNG[0] >>> 0) / 4294967296; }
  function makeBag(list) { return { ix: Int16Array.from(list), n: list.length, i: list.length, last: -1 }; }
  function bagShuffle(b) {
    const a = b.ix;
    for (let i = b.n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    if (b.n > 1 && a[0] === b.last) { const j = 1 + Math.floor(rand() * (b.n - 1)), t = a[0]; a[0] = a[j]; a[j] = t; }
    b.i = 0;
  }
  // the next index from the bag, skipping `bad` (a Uint8Array of failed tracks); -1 when nothing can play
  function bagNext(b, bad) {
    for (let tries = 0; tries < 2 * b.n + 1; tries++) {
      if (b.i >= b.n) { if (!b.n) return -1; bagShuffle(b); }
      const t = b.ix[b.i++];
      if (bad && bad[t]) continue;
      b.last = t; return t;
    }
    return -1;
  }

  // ---- PURE: the cruise and the context ---------------------------------------------------------------------
  // st: Float64Array(2) [in cruise, seconds the entry conditions have held]; returns 1 in a cruise
  function cruiseStep(st, onGround, agl, V, vs, flap, dt) {
    const approach = flap > CRUISE.flapMax || (vs < CRUISE.approachVs && agl < CRUISE.approachAgl);
    if (onGround > 0 || agl < CRUISE.exitAgl || approach || V < CRUISE.minV) { st[0] = 0; st[1] = 0; return 0; }
    if (st[0] > 0) return 1;
    if (agl >= CRUISE.enterAgl) { st[1] += dt; if (st[1] >= CRUISE.dwellS) st[0] = 1; } else st[1] = 0;
    return st[0] > 0 ? 1 : 0;
  }
  function contextOf(welcome, photo, garage, musicGarage, musicFlight, cruise) {
    if (photo) return C_PHOTO;
    if (welcome || garage) return musicGarage ? (welcome ? C_WELCOME : C_GARAGE) : C_NONE;
    return musicFlight && cruise ? C_CRUISE : C_NONE;
  }

  // ---- THE PLAYER ---------------------------------------------------------------------------------------------
  // the deck slots (Float64Array per deck: a double in an object field is a fresh heap box per write)
  const ST_IDLE = 0, ST_LOADED = 1, ST_PLAYING = 2, ST_FADING = 3;
  const K_STATE = 0, K_TRACK = 1, K_POS = 2, K_DUR = 3, K_STOP = 4, K_T0 = 5, K_FD = 6, K_FA = 7, K_FB = 8, K_PAUSED = 9, K_N = 10;
  const DK = new Float64Array(2 * K_N);
  // the player's slots: cur context, gap left, duck left, now-playing left, retry left, the active deck, photo
  const PS = new Float64Array(8);
  const S_CUR = 0, S_GAP = 1, S_DUCK = 2, S_NOW = 3, S_RETRY = 4, S_ACT = 5, S_PHOTO = 6;
  const CRUISE_ST = new Float64Array(2);
  const RESUME_T = new Int16Array(4).fill(-1), RESUME_P = new Float64Array(4);
  let cat = [], urls = [], trims = new Float64Array(0), nows = [], lists = [[], [], [], []], bags = [], bad = new Uint8Array(0);
  let ctx = null, A = null, decks = [], duck = null, offs = [];
  const C = { elements: 0, starts: 0, xfades: 0, ducks: 0 };   // counters (the gate reads them)
  PS[S_CUR] = C_NONE; PS[S_GAP] = -1; PS[S_ACT] = -1;
  for (let k = 0; k < 2; k++) DK[k * K_N + K_STOP] = -1;

  function setCatalogue(c) {
    cat = Array.isArray(c) ? c.filter(t => t && Array.isArray(t.contexts) && typeof t.file === 'string') : [];
    const base = typeof G.FLYDIY_ASSET_BASE === 'string' ? G.FLYDIY_ASSET_BASE : '';
    urls = cat.map(t => (/^(https?:|\/|\.)/.test(t.file) ? t.file : base + t.file));
    trims = Float64Array.from(cat.map(trimOf));
    nows = cat.map(nowLine);
    lists = contextLists(cat);
    bags = lists.map(makeBag);
    bad = new Uint8Array(cat.length);
    RESUME_T.fill(-1);
  }
  const eligible = (t, c) => c >= 0 && t >= 0 && lists[c].indexOf(t) >= 0;   // (a context switch, not a frame)

  // the gain a deck's fade has at audio time t: FA x cos + FB x sin of the same phase (a level: FD = 0 -> FB)
  function lvlAt(k, t) {
    const o = k * K_N, fd = DK[o + K_FD];
    const x = fd > 0 ? Math.max(0, Math.min(1, (t - DK[o + K_T0]) / fd)) : 1;
    const ph = x * Math.PI / 2;
    return x >= 1 ? DK[o + K_FB] : DK[o + K_FA] * Math.cos(ph) + DK[o + K_FB] * Math.sin(ph);
  }
  // schedule an equal-power fade of deck k from its present level to `to` over d seconds (d = 0: a step)
  function fadeTo(k, to, d) {
    const o = k * K_N, dk = decks[k], p = dk.gain.gain, t = ctx.currentTime, from = lvlAt(k, t);
    DK[o + K_T0] = t; DK[o + K_FD] = d; DK[o + K_FA] = from; DK[o + K_FB] = to;
    if (p.cancelScheduledValues) p.cancelScheduledValues(t);
    if (!(d > 0)) { if (p.setValueAtTime) p.setValueAtTime(to, t); else p.value = to; return; }
    const cv = dk.curve;
    for (let i = 0; i < XF_N; i++) cv[i] = from * CURVE_OUT[i] + to * CURVE_IN[i];
    try { p.setValueCurveAtTime(cv, t, d); }
    catch (e) { p.setTargetAtTime(to, t, d / 3); }   // a browser that refuses the curve still fades
  }
  function release(k) {
    const o = k * K_N, el = decks[k] && decks[k].el;
    DK[o + K_STATE] = ST_IDLE; DK[o + K_TRACK] = -1; DK[o + K_STOP] = -1; DK[o + K_PAUSED] = 0; DK[o + K_POS] = 0;
    if (PS[S_ACT] === k) PS[S_ACT] = -1;
    if (!el) return;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
    el.preload = 'none';
  }
  function load(k, t, pos) {
    const o = k * K_N, el = decks[k].el;
    release(k);
    DK[o + K_STATE] = ST_LOADED; DK[o + K_TRACK] = t; DK[o + K_POS] = pos || 0; DK[o + K_DUR] = cat[t].durationS;
    DK[o + K_FD] = 0; DK[o + K_FB] = 0;
    el.preload = 'auto';
    el.src = urls[t];
    if (pos > 0) { try { el.currentTime = pos; } catch (e) {} }
  }
  // start deck k (loading track t when it is not already loaded with it); fade: the seconds of its fade-in (0 = full)
  function start(k, t, fade, pos) {
    const o = k * K_N;
    if (!(DK[o + K_STATE] === ST_LOADED && DK[o + K_TRACK] === t)) load(k, t, pos);
    DK[o + K_STATE] = ST_PLAYING;
    PS[S_ACT] = k; PS[S_GAP] = -1;
    DK[o + K_FD] = 0; DK[o + K_FB] = 0;   // from silence
    fadeTo(k, trims[t], fade);
    C.starts++;
    try { const r = decks[k].el.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    if (PS[S_CUR] === C_GARAGE) showNow(t);
    if (A) A.emit('music', t);
  }
  function fadeOut(k, d) {
    const o = k * K_N;
    if (DK[o + K_STATE] === ST_IDLE) return;
    if (DK[o + K_STATE] === ST_LOADED) { release(k); return; }
    DK[o + K_STATE] = ST_FADING; DK[o + K_STOP] = d + 0.05;
    if (PS[S_ACT] === k) PS[S_ACT] = -1;
    fadeTo(k, 0, d);
  }
  const other = k => (k === 0 ? 1 : 0);
  // a free deck: an idle one, else the one fading the longest (cut), never the active one
  function freeDeck() {
    const a = PS[S_ACT];
    for (let k = 0; k < 2; k++) if (k !== a && DK[k * K_N + K_STATE] === ST_IDLE) return k;
    const k = a >= 0 ? other(a) : (DK[K_STOP] <= DK[K_N + K_STOP] ? 0 : 1);
    release(k);
    return k;
  }
  // the next track of context c on a free deck: the preloaded one if it is there, the resume point, or the bag's
  function startNext(c, fade) {
    if (c < 0 || !bags[c]) return;
    for (let k = 0; k < 2; k++) {
      const o = k * K_N;
      if (DK[o + K_STATE] === ST_LOADED && k !== PS[S_ACT] && eligible(DK[o + K_TRACK], c)) { start(k, DK[o + K_TRACK], fade, DK[o + K_POS]); return; }
    }
    let t = RESUME_T[c], pos = 0;
    if (t >= 0 && !bad[t] && eligible(t, c)) { pos = RESUME_P[c]; bags[c].last = t; } else t = bagNext(bags[c], bad);
    RESUME_T[c] = -1;
    if (t < 0) return;
    start(freeDeck(), t, fade, pos);
  }
  function preloadNext(c) {
    const a = PS[S_ACT], k = a >= 0 ? other(a) : 0, o = k * K_N;
    if (DK[o + K_STATE] !== ST_IDLE) return;
    const t = bagNext(bags[c], bad);
    if (t >= 0) load(k, t, 0);
  }
  function switchTo(c) {
    const prev = PS[S_CUR], a = PS[S_ACT];
    PS[S_CUR] = c; PS[S_GAP] = -1; PS[S_RETRY] = 0;
    const at = a >= 0 ? DK[a * K_N + K_TRACK] : -1;
    // a preloaded deck for the old context goes
    for (let k = 0; k < 2; k++) if (DK[k * K_N + K_STATE] === ST_LOADED && !eligible(DK[k * K_N + K_TRACK], c)) release(k);
    if (a >= 0 && c >= 0 && eligible(at, c)) return;   // the track plays on into the new context
    if (a >= 0) {
      const pos = DK[a * K_N + K_POS];
      if (prev >= 0 && pos > 1 && pos < DK[a * K_N + K_DUR] - RESUME_S) { RESUME_T[prev] = at; RESUME_P[prev] = pos; }
      fadeOut(a, XFADE_S);
    }
    hideNow();
    if (c >= 0) startNext(c, a >= 0 ? XFADE_S : (GAPPED[c] ? 0 : XFADE_S));
  }

  // the element events (made once per element, on connect): the clocks into typed slots, the end, a failure
  function onTime(k) { const el = decks[k].el, v = +el.currentTime; if (v === v) DK[k * K_N + K_POS] = v; }
  function onDur(k) { const el = decks[k].el, v = +el.duration; if (v > 0 && v < 1e6) DK[k * K_N + K_DUR] = v; }
  function onEnded(k) {
    const st = DK[k * K_N + K_STATE], was = PS[S_ACT] === k;
    release(k);
    if (st !== ST_PLAYING || !was) return;
    const c = PS[S_CUR];
    if (c < 0) return;
    if (GAPPED[c]) PS[S_GAP] = GAP_MIN_S + rand() * (GAP_MAX_S - GAP_MIN_S);
    else startNext(c, 0);   // (a track whose length was wrong: no crossfade came)
  }
  function onError(k) {
    const t = DK[k * K_N + K_TRACK], was = PS[S_ACT] === k && DK[k * K_N + K_STATE] === ST_PLAYING;
    if (t >= 0) { bad[t] = 1; console.warn('flyDiy music: ' + (cat[t] && cat[t].file) + ' did not play; skipped for this page'); }
    release(k);
    if (was) PS[S_RETRY] = RETRY_S;
  }

  // ---- DUCKING -----------------------------------------------------------------------------------------------
  function onDuck() {
    if (!ctx || !duck) return;
    C.ducks++;
    const fresh = !(PS[S_DUCK] > 0);
    PS[S_DUCK] = DUCK_HOLD_S;
    if (!fresh) return;
    const p = duck.gain, t = ctx.currentTime;
    if (p.cancelScheduledValues) p.cancelScheduledValues(t);
    p.setTargetAtTime(DUCK_K, t, DUCK_IN_TAU);
  }
  function unDuck() {
    PS[S_DUCK] = 0;
    const p = duck.gain, t = ctx.currentTime;
    if (p.cancelScheduledValues) p.cancelScheduledValues(t);
    p.setTargetAtTime(1, t, DUCK_OUT_TAU);
  }

  // ---- THE FRAME ---------------------------------------------------------------------------------------------
  function update(P, dt, au) {
    if (!ctx) return;
    const s = P.s, I = P.I, garage = au.inGarage;
    const cruise = garage ? (CRUISE_ST[0] = 0, CRUISE_ST[1] = 0, 0) : cruiseStep(CRUISE_ST, s[I.onGround], s[I.agl], s[I.V], s[I.vs], s[I.flap], dt);
    const want = contextOf(au.welcome, PS[S_PHOTO] > 0, garage, au.get('musicGarage'), au.get('musicFlight'), cruise);
    if (want !== PS[S_CUR]) switchTo(want);
    if (au.state === 'suspended') return;   // the timers wait with the sound
    for (let k = 0; k < 2; k++) {
      const o = k * K_N;
      if (DK[o + K_STOP] >= 0) { DK[o + K_STOP] -= dt; if (DK[o + K_STOP] <= 0) release(k); }
    }
    if (PS[S_DUCK] > 0) { PS[S_DUCK] -= dt; if (PS[S_DUCK] <= 0) unDuck(); }
    if (PS[S_NOW] > 0) { PS[S_NOW] -= dt; if (PS[S_NOW] <= 0) hideNow(); }
    const c = PS[S_CUR];
    if (c < 0) return;
    if (PS[S_RETRY] > 0) { PS[S_RETRY] -= dt; if (PS[S_RETRY] <= 0) { PS[S_RETRY] = 0; startNext(c, 0); } return; }
    const a = PS[S_ACT];
    if (GAPPED[c]) {
      if (PS[S_GAP] >= 0) {
        PS[S_GAP] -= dt;
        if (PS[S_GAP] <= LEAD_S) preloadNext(c);
        if (PS[S_GAP] <= 0) { PS[S_GAP] = -1; startNext(c, 0); }
      } else if (a < 0) startNext(c, 0);   // nothing playing, no gap running (a failed start, a skip into silence)
      return;
    }
    if (a < 0) { startNext(c, XFADE_S); return; }
    const o = a * K_N, rem = DK[o + K_DUR] - DK[o + K_POS], xf = Math.min(XFADE_S, DK[o + K_DUR] / 4);   // (a short track: a shorter fade)
    if (rem <= xf + LEAD_S) preloadNext(c);
    if (rem <= xf) { C.xfades++; fadeOut(a, xf); startNext(c, xf); }
  }

  // skip: the next track now (a crossfade; in a garage gap, the wait ends)
  function skip() {
    const c = PS[S_CUR], a = PS[S_ACT];
    if (!ctx || c < 0) return false;
    if (a >= 0) fadeOut(a, XFADE_S);
    PS[S_GAP] = -1;
    startNext(c, a >= 0 ? XFADE_S : 0);
    return true;
  }

  // ---- THE NOW-PLAYING LINE (the garage; made on its first use) ------------------------------------------------
  let nowEl = null;
  function showNow(t) {
    const D = G.document;
    if (!D || !D.createElement || !D.body) return;
    if (!nowEl) {
      nowEl = D.createElement('div');
      nowEl.id = 'musicNow';
      nowEl.setAttribute('aria-live', 'polite');
      nowEl.style.cssText = 'position:fixed;left:calc(var(--ws-left, 0px) + 22px);bottom:18px;z-index:41;pointer-events:none;' +
        'font:12px/1.4 inherit;letter-spacing:.02em;color:rgba(235,232,224,.82);text-shadow:0 1px 3px rgba(0,0,0,.6);' +
        'opacity:0;transition:opacity 1.2s ease;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      D.body.appendChild(nowEl);
    }
    nowEl.textContent = '♪ ' + nows[t];
    nowEl.style.opacity = '1';
    PS[S_NOW] = NOW_S;
  }
  function hideNow() { PS[S_NOW] = 0; if (nowEl) nowEl.style.opacity = '0'; }
  const nowPlaying = () => { const a = PS[S_ACT]; const t = a >= 0 ? DK[a * K_N + K_TRACK] : -1; return t >= 0 ? cat[t] : null; };

  // ---- THE CREDITS SCREEN (on the shed's about line, and the sound menu) ----------------------------------------
  function openCredits() {
    const D = G.document;
    if (!D || !D.createElement || !D.body) return null;
    const old = D.getElementById && D.getElementById('musicCredits');
    if (old) { old.remove(); return null; }
    const box = D.createElement('div');
    box.id = 'musicCredits';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Music and sound credits');
    box.style.cssText = 'position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(10,10,12,.62)';
    const card = D.createElement('div');
    card.style.cssText = 'max-width:min(640px,92vw);max-height:84vh;overflow:auto;padding:22px 24px;background:#1b1c1f;color:#e9e6de;' +
      'border:1px solid rgba(255,255,255,.12);border-radius:6px;font:13px/1.5 inherit';
    const el = (tag, txt, css) => { const e = D.createElement(tag); if (txt != null) e.textContent = txt; if (css) e.style.cssText = css; return e; };
    card.appendChild(el('h2', 'Music & sound', 'margin:0 0 12px;font-size:16px;font-weight:600'));
    card.appendChild(el('h3', 'Music', 'margin:10px 0 6px;font-size:13px;opacity:.75'));
    const rows = creditRows(cat);
    if (!rows.length) card.appendChild(el('p', 'No music ships yet.', 'margin:0;opacity:.7'));
    const ul = el('ul', null, 'margin:0;padding-left:18px');
    for (const r of rows) {
      const li = el('li', null, 'margin:2px 0');
      li.dataset.track = r.id;
      if (r.source) { const a = el('a', r.line, 'color:inherit'); a.href = r.source; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
      else li.textContent = r.line;
      ul.appendChild(li);
    }
    if (rows.length) card.appendChild(ul);
    card.appendChild(el('h3', 'Sound', 'margin:14px 0 6px;font-size:13px;opacity:.75'));
    for (const r of SOUND_CREDITS) {
      const p = el('p', null, 'margin:2px 0');
      if (r.what) p.appendChild(el('b', r.what + ': '));
      if (r.url) { const a = el('a', r.line, 'color:inherit'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a); }
      else p.appendChild(el('span', r.line));
      card.appendChild(p);
    }
    card.appendChild(el('p', 'The full list, with every licence: CREDITS.md in the game\'s repository.', 'margin:14px 0 0;opacity:.6'));
    const close = el('button', 'close', 'margin-top:14px'); close.className = 'pill';
    card.appendChild(close);
    box.appendChild(card);
    const shut = () => { box.remove(); if (D.removeEventListener) D.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    close.onclick = shut;
    box.onclick = e => { if (e.target === box) shut(); };
    if (D.addEventListener) D.addEventListener('keydown', onKey, true);
    D.body.appendChild(box);
    return box;
  }
  // the about line's button (body.html #credit, the shed's information panel): legal attribution, so it is there
  // whether the sound is on or not
  function mountCreditLink() {
    const D = G.document, line = D && D.getElementById && D.getElementById('credit');
    if (!line || !D.createElement || (D.getElementById('musicCreditsBtn'))) return false;
    const b = D.createElement('a');
    b.id = 'musicCreditsBtn'; b.href = '#'; b.textContent = 'music & sound credits';
    b.onclick = e => { if (e && e.preventDefault) e.preventDefault(); openCredits(); };
    line.appendChild(D.createTextNode(' · '));
    line.appendChild(b);
    return true;
  }

  // ---- THE SOURCE ----------------------------------------------------------------------------------------------
  function connect(c, au) {
    disconnect();
    ctx = c; A = au;
    const D = G.document;
    duck = c.createGain(); duck.gain.value = 1;
    duck.connect(au.bus('music'));
    decks = [];
    if (!D || !D.createElement || !c.createMediaElementSource) { ctx = null; return; }   // no media elements here
    for (let k = 0; k < 2; k++) {
      const el = D.createElement('audio');
      C.elements++;
      el.preload = 'none';
      el.crossOrigin = 'anonymous';
      const src = c.createMediaElementSource(el), gain = c.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(duck);
      const h = { timeupdate: () => onTime(k), durationchange: () => onDur(k), loadedmetadata: () => onDur(k), ended: () => onEnded(k), error: () => onError(k) };
      for (const ev in h) el.addEventListener(ev, h[ev]);
      decks.push({ el, src, gain, h, curve: new Float32Array(XF_N) });
      DK[k * K_N + K_STATE] = ST_IDLE; DK[k * K_N + K_TRACK] = -1; DK[k * K_N + K_STOP] = -1;
    }
    PS[S_CUR] = C_NONE; PS[S_ACT] = -1; PS[S_GAP] = -1; PS[S_DUCK] = 0;
    offs = [au.onEvent('engine', onDuck), au.onEvent('stall', onDuck), au.onEvent('duck', onDuck),
      au.onEvent('photo', on => setPhoto(on)),
      au.onEvent('suspend', () => { for (let k = 0; k < 2; k++) if (DK[k * K_N + K_STATE] >= ST_PLAYING) { DK[k * K_N + K_PAUSED] = 1; try { decks[k].el.pause(); } catch (e) {} } }),
      au.onEvent('resume', () => { for (let k = 0; k < 2; k++) if (DK[k * K_N + K_PAUSED]) { DK[k * K_N + K_PAUSED] = 0; try { const r = decks[k].el.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {} } })];
  }
  function disconnect() {
    for (const f of offs) { try { f(); } catch (e) {} }
    offs = [];
    for (let k = 0; k < decks.length; k++) {
      release(k);
      const d = decks[k];
      for (const ev in d.h) d.el.removeEventListener(ev, d.h[ev]);
      try { d.src.disconnect(); d.gain.disconnect(); } catch (e) {}
    }
    decks = [];
    try { if (duck) duck.disconnect(); } catch (e) {}
    duck = null; ctx = null; A = null;
    PS[S_CUR] = C_NONE; PS[S_ACT] = -1;
    hideNow();
  }
  function setPhoto(on) { PS[S_PHOTO] = on ? 1 : 0; }

  setCatalogue(G.FLYDIY_MUSIC || []);
  const api = {
    CTX_NAMES, CRUISE, XFADE_S, GAP_MIN_S, GAP_MAX_S, DUCK_K, DUCK_HOLD_S, LUFS_TARGET, SOUND_CREDITS, FILE_RE, LICENCE_RE,
    validate, contextLists, creditRows, creditLine, cruiseStep, contextOf, makeBag, bagNext, trimOf,
    seed(n) { RNG[0] = (n >>> 0) || 1; }, setCatalogue, get catalogue() { return cat; },
    skip, setPhoto, openCredits, mountCreditLink, nowPlaying,
    get context() { return PS[S_CUR] >= 0 ? CTX_NAMES[PS[S_CUR]] : 'none'; },
    // the gate's window on the slots (read-only views)
    _dk: DK, _ps: PS, _C: C, _decks: () => decks, _lvlAt: lvlAt, source: { connect, update, disconnect },
  };

  mountCreditLink();
  const AU = G.AUDIO;
  if (AU && AU.enabled) {
    AU.addSource('music', api.source);
    if (AU.addRows) AU.addRows((body, kit) => {
      const np = nowPlaying();
      if (kit.note) kit.note(body, np ? 'Now playing: ' + nowLine(np) : (cat.length ? 'No music playing.' : 'No music ships yet.'));
      const btn = (label, text, fn) => { const r = kit.row(body, label), b = G.document.createElement('button'); b.textContent = text; b.className = 'pill'; b.onclick = fn; r.appendChild(b); return r; };
      btn('skip track', 'skip', () => skip());
      btn('music credits', 'open', () => openCredits());
    });
  }
  return api;
})();
if (typeof window !== 'undefined') window.AUDIO_MUSIC = AUDIO_MUSIC;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_MUSIC;
