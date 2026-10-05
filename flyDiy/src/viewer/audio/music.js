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
// THE STATIONS (SND-RADIO G1675-G1679, the user's ruling 2026-10-04: six calm, purely instrumental stations - jazz,
// lofi, dubambient, roots = "Radio Jolene", blues, classical; tools/audio/music_selection_v1.json): ONE current station
// per player (localStorage flydiy.audio.station, default lofi; 'off' = the radio off), each track's `station` (absent =
// lofi). The contexts still decide WHEN music plays; the station decides WHAT: per context its own tracks (FALLBACK's
// borrowing inside the station), else LO-FI's for that context (a station with no track at all plays lo-fi and the
// picker says so). Each station keeps ITS OWN shuffle bags (made on first use, kept across switches: no repeat within
// a station's round, whatever was played elsewhere meanwhile). A switch crossfades into the new station's next track.
// The picker: a 'station' row in the sound settings (both rails: AUDIO.addRows), and the keys [ / ] (previous / next
// station; free in input.js's ACTIONS - and yielded to any profile binding that takes them; never with a modifier or
// in a text field).
// RADIO JOLENE TALKS (the roots station; radio_talk.js writes the breaks from the game, speechSynthesis reads them):
// a break every TALK_EVERY tracks (the setting 'talk every', 1..6, default 2; 'Radio Jolene talk' on by default), and
// on tuning in (the ID and the weather). The NEXT track starts UNDER the voice at BED_K (16 %) and rises to its level
// over BED_UP_S (1.5 s) when the voice stops - the bed is the deck's own gain (the voice is not Web Audio and cannot
// be ducked by it). In the garage a break takes the place of the silence. NEVER: before the gesture (the speaker is
// made in connect), while a duck holds (engine start / catch, the stall warning: the break waits for the next track),
// during one (a duck event cancels it), in a suspend (hidden / paused / unfocused cancel it), or with the voice at 0.
// The voice: by name (flydiy.audio.radioVoice; else Microsoft George en-GB when present), rate / pitch 0.95, its
// volume master x music x VOICE_K (the user's bench: music at 0.8 of the voice). A browser that never fires onend is
// ended by a watchdog (the break's estimated length + TALK_SLACK_S).
// THE RECORDED VOICE (G1683, SND-RADIO-2; ruling s12): the talker (RADIO_TALK.makeTalker) plays each segment's CLIPS
// (AUDIO_VOICE, the station's voice rendered offline - norman) when every key of it has a clip, and falls back to
// speechSynthesis PER SEGMENT; consecutive clip segments play as one gap-free sequence. The clips are Web Audio: they
// pass radioIn (the level: clipK = VOICE_K x the clips' -20 LUFS brought to the tracks' -16) -> the music's DUCK -> the
// music bus, so the ducks, the music volume and the context's suspend reach them; the bed under them is the deck's
// gain as before, and the watchdog's estimate is the clips' own length.
// THE LIVING RADIO (G1700-G1704, SND-RADIO-3): the talk is a BROADCAST written offline (tools/audio/radio_gen.js) and rendered
// as whole takes; radio_talk.js chooses and sequences them (the program's next break, the back-announce of the track just
// played, the weather in words from the game) and keeps a persisted cursor - a new session continues the broadcast. The
// script is fetched when Radio Jolene is tuned with a context (loadScript; no break before it is in). On Radio Jolene with
// its talk on, the garage FADES song to song like every other context (no silences: a station does not go quiet), and a
// break owed starts TALK_UP_S before the track's end: Norman talks over the fading outro (equal-power, over what is left
// of the track) and the next track's intro comes in under him at the bed.
// THE MIX (G1681): the seventh station, 'Random' - every track the six would play in a context, one bag, no repeat
// inside a round. Radio Jolene's talk stays on its own station (roots): the mix is music only.
//
// MY MUSIC (G1712, SND-BOOMBOX; the user 2026-10-05: "the ability to point to a local music folder"): an eighth, VIRTUAL
// station, 'mine' - the player's own files (my_music.js picks the folder; setUserTracks hands them here). Its tracks are
// appended to the catalogue as { user: 1, blob } entries past the shipped ones (baseN): the shipped indices, their bags
// and their resume points never move. They play through the same two decks, the same crossfade, ducks and suspend; a
// track's blob: object URL is made when a deck loads it and REVOKED when that deck lets it go (release), so at most two
// exist at a time and a dropped folder leaves none. No silences between them (a station does not go quiet), no talk
// (talkDue is Radio Jolene's alone), never in the mix, the credits or the [ / ] cycle until a folder is there. A track's
// length is unknown until its metadata (USER_DUR_S stands in until durationchange). The station is persisted like any
// other; a page that loads on 'mine' plays the start station until the folder is back (wantMine), then returns to it.
// THE BOOMBOX AS THE SOURCE (G1714, SND-BOOMBOX's stretch): in the garage the music leans a little toward the radio when
// the camera is near it - a StereoPanner between the duck and the music bus (space.js's room send follows it). The radio's
// place is handed in when the kit is placed (setSourcePos; boombox.js placed()); every PAN_EVERY_S the camera's right axis
// against the direction to it gives the side, scaled by PAN_K and by how near (full within PAN_NEAR m, nothing past
// PAN_FAR m); off the garage, or with no radio, the centre. A move under PAN_STEP schedules nothing; nothing allocates.
// THE CATALOGUE (src/viewer/audio/music_catalogue.json, written by the coordinator's prep tool from the user's
// picks; the build inlines it as window.FLYDIY_MUSIC - a manifest, not a media file: under media/ an unhashed
// JSON would be held forever by sw.js's cache-first rule, and GATE MEDIA would call it an orphan):
//   [{ id, file, title, artist, album, licence, source, station?, contexts: ['garage','welcome','cruise','photo'],
//      lufs, durationS, credit? }]      station: one of STATIONS (absent = 'lofi')
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
  // THE STATIONS (key, the picker's label) - the keys are music_selection_v1.json's, in its order (GATE AUDIO holds it)
  const STATIONS = [['jazz', 'Jazz'], ['lofi', 'Lo-fi / Hip-hop'], ['dubambient', 'Dub / Ambient'], ['roots', 'Radio Jolene (local roots)'],
    ['blues', 'Blues'], ['classical', 'Classical'], ['mix', 'Random']];
  // G1681 THE MIX ('Random', the user: "a random station mixing all the music"): a VIRTUAL station - no track is
  // tagged mix (validate refuses it); per context its list is the UNION of the six stations' lists (each with its own
  // fallbacks), so its bag is every track any station would play there, shuffled, no repeat inside a round
  const ST_MIX = 'mix', STATION_KEYS = STATIONS.map(s => s[0]), ST_DEFAULT = 'lofi', ST_TALK = 'roots';
  const REAL_KEYS = STATION_KEYS.filter(k => k !== ST_MIX);
  // G1712 MY MUSIC: the virtual station of the player's own files (above); its label, the length a track is given until
  // its metadata says, the file names it keeps
  const ST_MINE = 'mine', MINE_LABEL = 'My music', USER_DUR_S = 3600;
  const MINE_RE = /\.(mp3|ogg|oga|opus|m4a|aac|wav|flac)$/i;
  // G1714 the lean toward the radio (above)
  const PAN_K = 0.35, PAN_NEAR = 2, PAN_FAR = 9, PAN_EVERY_S = 0.25, PAN_STEP = 0.02, PAN_TAU = 0.3;
  const SRC = new Float64Array(5);   // the radio's x, y, z, whether there is one, the pan last scheduled
  const BED_K = 0.16, BED_IN_S = 1.5, BED_UP_S = 1.5, VOICE_K = 1 / 0.8, TALK_SLACK_S = 8;
  // G1703 THE TALK-UP (SND-RADIO-3): a break owed starts TALK_UP_S before the track's end - Norman talks over its fading
  // outro (the track fades out over what is left of it, equal-power) and the next track's intro comes in under him at the
  // bed; a late tune-in (the broadcast script still loading when the station was tuned) talks over a track at most
  // TUNE_LATE_S into it
  const TALK_UP_S = 6, TUNE_LATE_S = 10;
  // G1683 THE RECORDED VOICE's level: its clips are levelled to VOICE_LUFS (prep_voice.js; the catalogue's render.lufs),
  // the tracks to LUFS_TARGET - the radio gain lifts the clips by the difference, then VOICE_K (the voice over the music)
  const VOICE_LUFS = -20;
  const TALK_EVERY = 2, TALK_MIN = 1, TALK_MAX = 6;
  const PFX = 'flydiy.audio.';
  const prefGet = (k, d) => { try { const v = G.localStorage && G.localStorage.getItem(PFX + k); return v == null ? d : v; } catch (e) { return d; } };
  const prefPut = (k, v) => { try { if (G.localStorage) G.localStorage.setItem(PFX + k, String(v)); } catch (e) {} };
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
      if (t.station != null && REAL_KEYS.indexOf(t.station) < 0) F.push(at + 'station ' + t.station + ' is not one of ' + REAL_KEYS.join(', ') + (t.station === ST_MIX ? ' (the mix is virtual: it has no tracks of its own)' : ''));
      if (!(t.durationS > 0)) F.push(at + 'durationS must be > 0');
      if (t.lufs != null && !(typeof t.lufs === 'number' && t.lufs < 0 && t.lufs > -60)) F.push(at + 'lufs ' + t.lufs + ' out of range');
    });
    return F;
  }
  // per context, the catalogue indices that may play there (FALLBACK when a context has none of its own); idx: the
  // indices to choose from (a station's), else the whole catalogue
  function contextLists(cat, idx) {
    const ix = idx || cat.map((t, i) => i);
    // the loading screens deal from EVERY track of the station (the user, 2026-10-05: "random songs for the loadings"),
    // not only the ones tagged 'welcome'
    const L = CTX_NAMES.map((n, c) => (c === C_WELCOME ? ix.slice() : ix.filter(i => cat[i].contexts.indexOf(n) >= 0)));
    return L.map((l, c) => (l.length || FALLBACK[c] < 0 ? l : L[FALLBACK[c]].slice()));
  }
  const stationOf = t => (t && t.station) || ST_DEFAULT;
  // a station's lists: its own tracks per context, else lo-fi's for that context (fell[c] = 1); empty = it has none at all
  function stationLists(cat, st) {
    if (st === ST_MINE) {   // G1712: every one of the player's files, in every context
      const m = []; for (let i = 0; i < cat.length; i++) if (cat[i] && cat[i].user) m.push(i);
      return { lists: CTX_NAMES.map(() => m.slice()), fell: [0, 0, 0, 0], empty: !m.length };
    }
    if (STATION_KEYS.indexOf(st) < 0) return { lists: CTX_NAMES.map(() => []), fell: [0, 0, 0, 0], empty: true };
    if (st === ST_MIX) {   // the union of the six, in catalogue order, each track once
      const u = CTX_NAMES.map(() => new Uint8Array(cat.length));
      for (const k of REAL_KEYS) stationLists(cat, k).lists.forEach((l, c) => { for (const i of l) u[c][i] = 1; });
      const lists = u.map(m => { const l = []; for (let i = 0; i < m.length; i++) if (m[i]) l.push(i); return l; });
      return { lists, fell: [0, 0, 0, 0], empty: !cat.length };
    }
    const of = k => cat.map((t, i) => (stationOf(t) === k ? i : -1)).filter(i => i >= 0);
    const mine = of(st), own = contextLists(cat, mine), lo = st === ST_DEFAULT ? own : contextLists(cat, of(ST_DEFAULT));
    const fell = own.map(l => (l.length || st === ST_DEFAULT ? 0 : 1));
    return { lists: own.map((l, c) => (l.length ? l : lo[c].slice())), fell, empty: !mine.length };
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
  // a NEW deal every launch (the user, 2026-10-05: "always the same music when I start the garage"): seeded from
  // the machine's randomness at load; the gate re-seeds with seed(n) to replay
  try { const c = G.crypto; if (c && c.getRandomValues) c.getRandomValues(RNG); else RNG[0] = (Math.random() * 4294967296) ^ Date.now(); } catch (e) {}
  if (!RNG[0]) RNG[0] = 0x9e3779b9;
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
  function contextOf(welcome, photo, garage, musicGarage, musicFlight, cruise, musicLoading) {
    if (photo) return C_PHOTO;
    if (welcome) return musicLoading ? C_WELCOME : C_NONE;   // a loading screen: its own switch (off by default)
    if (garage) return musicGarage ? C_GARAGE : C_NONE;
    return musicFlight && cruise ? C_CRUISE : C_NONE;
  }

  // ---- THE PLAYER ---------------------------------------------------------------------------------------------
  // the deck slots (Float64Array per deck: a double in an object field is a fresh heap box per write)
  const ST_IDLE = 0, ST_LOADED = 1, ST_PLAYING = 2, ST_FADING = 3;
  const K_STATE = 0, K_TRACK = 1, K_POS = 2, K_DUR = 3, K_STOP = 4, K_T0 = 5, K_FD = 6, K_FA = 7, K_FB = 8, K_PAUSED = 9, K_N = 10;
  const DK = new Float64Array(2 * K_N);
  // the player's slots: cur context, gap left, duck left, now-playing left, retry left, the active deck, photo; the
  // radio's: the bed (1, or BED_K under a talk), the talk's watchdog (s left; 0 = no talk), tracks since the last
  // break, a tune-in break owed
  const PS = new Float64Array(12);
  const S_CUR = 0, S_GAP = 1, S_DUCK = 2, S_NOW = 3, S_RETRY = 4, S_ACT = 5, S_PHOTO = 6, S_BED = 7, S_TALK = 8, S_COUNT = 9, S_TUNE = 10, S_PANT = 11;
  const REC = new Int16Array(2).fill(-1);   // the last two tracks started (the back-announce)
  PS[S_BED] = 1;
  const CRUISE_ST = new Float64Array(2);
  const RESUME_T = new Int16Array(4).fill(-1), RESUME_P = new Float64Array(4);
  let cat = [], urls = [], trims = new Float64Array(0), nows = [], lists = [[], [], [], []], bags = [], bad = new Uint8Array(0);
  // the radio: the station, its lists' fallbacks, every station's bags, the talk's settings, the voice, the rotation
  // the station a new player hears: Radio Jolene (the user, 2026-10-05); ST_DEFAULT stays lo-fi, the fallback of a
  // station with no tracks and of a track with no station
  const ST_START = ST_TALK;
  let station = prefGet('station', ST_START), fell = [0, 0, 0, 0], bagsBy = {};
  // G1712: a page that loads on 'mine' has no folder yet - it plays the start station and goes back once one is handed in
  let wantMine = station === ST_MINE, baseN = 0, mineName = '', prevStation = ST_START, lastOn = station !== 'off' ? station : ST_START;
  if (station !== 'off' && STATION_KEYS.indexOf(station) < 0) station = ST_START;
  // JOINING A BROADCAST (the user: "starting at a different point each time, like you take it in flight"): the first
  // track after a launch or a station switch starts JOIN_MIN..JOIN_MAX of its way in, like tuning a live radio; Norman's
  // tune-in is then skipped (TUNE_LATE_S) and he speaks at the next break. setJoin(false): the gate's replay
  const JOIN_MIN = 0.15, JOIN_MAX = 0.6;
  let JOIN_ON = 1, JOIN = 1;
  let talkOn = prefGet('radioTalk', '1') !== '0', voiceName = prefGet('radioVoice', '');
  let talkEvery = Math.max(TALK_MIN, Math.min(TALK_MAX, Math.round(+prefGet('radioEvery', TALK_EVERY)) || TALK_EVERY));
  let speaker = null, radioIn = null, lastSegs = null;   // the talker (RADIO_TALK.makeTalker), the recorded voice's gain (into the duck)
  const voiceApi = () => G.AUDIO_VOICE || (typeof AUDIO_VOICE !== 'undefined' ? AUDIO_VOICE : null);
  const clipK = () => { const v = G.FLYDIY_VOICE && G.FLYDIY_VOICE.voice, l = v && v.render && typeof v.render.lufs === 'number' ? v.render.lufs : VOICE_LUFS;
    return VOICE_K * Math.pow(10, (LUFS_TARGET - l) / 20); };
  let CUR = { v: '', k: 0, n: 0, h: {} };   // G1702: the broadcast's cursor (RADIO_TALK.cursor: persisted, a new session continues)
  let ctx = null, A = null, decks = [], duck = null, offs = [], panner = null;
  const C = { elements: 0, starts: 0, xfades: 0, ducks: 0, talks: 0, talkCuts: 0, blobs: 0, revoked: 0 };   // counters (the gate reads them)
  PS[S_CUR] = C_NONE; PS[S_GAP] = -1; PS[S_ACT] = -1;
  for (let k = 0; k < 2; k++) DK[k * K_N + K_STOP] = -1;

  function setCatalogue(c) {
    cat = Array.isArray(c) ? c.filter(t => t && Array.isArray(t.contexts) && typeof t.file === 'string') : [];
    const base = typeof G.FLYDIY_ASSET_BASE === 'string' ? G.FLYDIY_ASSET_BASE : '';
    urls = cat.map(t => (/^(https?:|\/|\.)/.test(t.file) ? t.file : base + t.file));
    trims = Float64Array.from(cat.map(trimOf));
    nows = cat.map(nowLine);
    bagsBy = {};
    rebuildLists();
    bad = new Uint8Array(cat.length);
    RESUME_T.fill(-1);
    baseN = cat.length; mineName = '';   // G1712: a new catalogue drops the player's files (the folder is handed in again)
  }
  // the station's lists and its bags (kept per station: a station's round survives a visit to another)
  function rebuildLists() {
    const r = stationLists(cat, station);
    lists = r.lists; fell = r.fell;
    bags = bagsBy[station] || (bagsBy[station] = lists.map(makeBag));
  }
  const eligible = (t, c) => c >= 0 && t >= 0 && lists[c].indexOf(t) >= 0;   // (a context switch, not a frame)
  // G1703: the garage's silences, except on Radio Jolene with its talk on - a radio station fades song to song
  const gapped = c => GAPPED[c] === 1 && !(station === ST_TALK && talkOn);
  const gap = c => gapped(c) && station !== ST_MINE;   // G1712: the player's own music does not go quiet either

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
    unblob(k);   // G1712: the player's file's object URL goes with it
  }
  // G1712: a deck's blob: URL for one of the player's files - made at its load, revoked at its release
  function unblob(k) {
    const d = decks[k];
    if (!d || !d.blobUrl) return;
    try { G.URL.revokeObjectURL(d.blobUrl); } catch (e) {}
    d.blobUrl = '';
    C.revoked++;
  }
  function srcOf(k, t) {
    if (urls[t]) return urls[t];
    const U = G.URL, b = cat[t] && cat[t].blob;
    if (!b || !U || typeof U.createObjectURL !== 'function') return '';
    unblob(k);
    try { decks[k].blobUrl = U.createObjectURL(b); C.blobs++; } catch (e) { decks[k].blobUrl = ''; }
    return decks[k].blobUrl;
  }
  function load(k, t, pos) {
    const o = k * K_N, el = decks[k].el;
    release(k);
    DK[o + K_STATE] = ST_LOADED; DK[o + K_TRACK] = t; DK[o + K_POS] = pos || 0; DK[o + K_DUR] = cat[t].durationS || USER_DUR_S;
    DK[o + K_FD] = 0; DK[o + K_FB] = 0;
    el.preload = 'auto';
    el.src = srcOf(k, t);
    if (pos > 0) { try { el.currentTime = pos; } catch (e) {} }
  }
  // start deck k (loading track t when it is not already loaded with it); fade: the seconds of its fade-in (0 = full)
  function start(k, t, fade, pos) {
    const o = k * K_N;
    if (!(DK[o + K_STATE] === ST_LOADED && DK[o + K_TRACK] === t)) load(k, t, pos);
    DK[o + K_STATE] = ST_PLAYING;
    PS[S_ACT] = k; PS[S_GAP] = -1;
    DK[o + K_FD] = 0; DK[o + K_FB] = 0;   // from silence
    fadeTo(k, trims[t] * PS[S_BED], fade);   // (under a talk: the bed)
    C.starts++;
    REC[1] = REC[0]; REC[0] = t;
    if (station === ST_TALK) PS[S_COUNT]++;
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
    if (JOIN && JOIN_ON && !(pos > 0) && cat[t].durationS > 0) pos = cat[t].durationS * (JOIN_MIN + (JOIN_MAX - JOIN_MIN) * rand());
    JOIN = 0;
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
    cancelTalk();
    PS[S_CUR] = c; PS[S_GAP] = -1; PS[S_RETRY] = 0;
    const at = a >= 0 ? DK[a * K_N + K_TRACK] : -1;
    // a preloaded deck for the old context goes
    for (let k = 0; k < 2; k++) if (DK[k * K_N + K_STATE] === ST_LOADED && !eligible(DK[k * K_N + K_TRACK], c)) release(k);
    if (a >= 0 && c >= 0 && eligible(at, c)) return;   // the track plays on into the new context
    if (a >= 0) {
      const pos = DK[a * K_N + K_POS];
      // (a loading screen never resumes: each one deals a new song)
      if (prev >= 0 && prev !== C_WELCOME && pos > 1 && pos < DK[a * K_N + K_DUR] - RESUME_S) { RESUME_T[prev] = at; RESUME_P[prev] = pos; }
      fadeOut(a, XFADE_S);
    }
    hideNow();
    if (c >= 0 && !nextWithTalk(c)) startNext(c, a >= 0 ? XFADE_S : (gap(c) ? 0 : XFADE_S));
  }

  // ---- THE RADIO: the station, the talk ---------------------------------------------------------------------------
  // a break is owed and may be spoken now
  function talkDue() {
    return station === ST_TALK && talkOn && !!speaker && speaker.available() && !(PS[S_DUCK] > 0) && !!A && A.state === 'running' &&
      (PS[S_TUNE] > 0 || PS[S_COUNT] >= talkEvery) && voiceVolume() > 0 && scriptReady();
  }
  const voiceVolume = () => (A ? Math.min(1, A.get('master') * A.get('music') * VOICE_K) : 0);
  // G1702: the broadcast script, fetched once Radio Jolene is tuned with a context (never before the gesture)
  const scriptReady = () => !!(G.RADIO_TALK && G.RADIO_TALK.ready && G.RADIO_TALK.ready());
  function loadScript() {
    const RT = G.RADIO_TALK;
    if (!ctx || station !== ST_TALK || !RT || !RT.load || RT.ready()) return;
    RT.load(G).then(ok => { if (ok) lateTuneIn(); });
  }
  // the script came in after the station was tuned: the owed tune-in talks over the track now playing, if it is young
  function lateTuneIn() {
    const a = PS[S_ACT];
    if (!(PS[S_TUNE] > 0) || a < 0 || DK[a * K_N + K_STATE] !== ST_PLAYING || DK[a * K_N + K_POS] > TUNE_LATE_S || PS[S_TALK] > 0 || !talkDue()) return;
    if (talk(true)) fadeTo(a, trims[DK[a * K_N + K_TRACK]] * BED_K, BED_IN_S);
  }
  const trackRow = t => (t >= 0 && cat[t] ? { id: cat[t].id, title: cat[t].title, artist: cat[t].artist } : null);   // (id: the back-announce's clips)
  // a break, then the next track of context c under it (at the bed, faded in over BED_IN_S); false when none is owed
  function nextWithTalk(c) {
    if (!talkDue() || typeof G.RADIO_TALK === 'undefined') { if (station === ST_TALK && !scriptReady()) loadScript(); return false; }
    if (!talk(PS[S_TUNE] > 0)) return false;
    startNext(c, BED_IN_S);
    return true;
  }
  // speak the next break (the tune-in: an ID and the weather); the bed is set, the cursor saved
  function talk(tune) {
    const RT = G.RADIO_TALK;
    const wx = RT.readGame(A.world, { sim: A.sim });
    const segs = RT.breakScript(CUR, wx, tune ? [] : [trackRow(REC[0])], { tuneIn: tune });
    if (RT.saveCursor) RT.saveCursor(CUR, G);
    lastSegs = segs;
    // (the recorded takes into radioIn - the duck, the music bus, the suspend - per segment; speechSynthesis for the rest)
    if (!segs.length || !speaker.speak(segs, { voice: voiceName, rate: RT.RATE, pitch: RT.PITCH, volume: voiceVolume(), dest: radioIn, gain: 1 }, endTalk)) return false;
    C.talks++;
    PS[S_TALK] = (speaker.seconds ? speaker.seconds(segs, RT.RATE) : RT.estSeconds(segs, RT.RATE)) + TALK_SLACK_S; PS[S_BED] = BED_K; PS[S_TUNE] = 0; PS[S_COUNT] = 0;
    return true;
  }
  // the voice stopped (or was stopped): the track under it rises to its level over BED_UP_S
  function endTalk() {
    PS[S_TALK] = 0;
    if (PS[S_BED] === 1) return;
    PS[S_BED] = 1;
    const a = PS[S_ACT];
    if (ctx && a >= 0 && DK[a * K_N + K_STATE] === ST_PLAYING) fadeTo(a, trims[DK[a * K_N + K_TRACK]], BED_UP_S);
  }
  function cancelTalk() {
    if (speaker && speaker.speaking) { C.talkCuts++; speaker.cancel(); }   // (its done() is endTalk)
    else if (PS[S_BED] !== 1 || PS[S_TALK] > 0) endTalk();
  }
  // the station: persisted; a switch crossfades into the new station's next track (roots: tuned in with a break)
  function setStation(s, quiet) {
    if (s !== 'off' && STATION_KEYS.indexOf(s) < 0 && !(s === ST_MINE && hasMine())) return false;
    if (s === station) return true;
    if (station !== ST_MINE) prevStation = station;
    if (s !== 'off') lastOn = s;
    wantMine = false;
    station = s; prefPut('station', s); JOIN = 1;
    tell();   // G1712: the bar and the boombox repaint
    cancelTalk();
    rebuildLists();
    RESUME_T.fill(-1);
    PS[S_COUNT] = 0; PS[S_TUNE] = s === ST_TALK ? 1 : 0;
    loadScript();
    if (!quiet) showLine('\u266A ' + stationLine(s));
    const c = PS[S_CUR];
    if (!ctx || c < 0 || s === 'off') return true;   // update()'s switch starts it, or fades it (the radio off)
    for (let k = 0; k < 2; k++) if (DK[k * K_N + K_STATE] === ST_LOADED) release(k);
    const a = PS[S_ACT];
    PS[S_GAP] = -1;
    if (a >= 0) fadeOut(a, XFADE_S);
    if (!nextWithTalk(c)) startNext(c, a >= 0 ? XFADE_S : 0);
    return true;
  }
  function stepStation(d) {
    const n = STATION_KEYS.length, i = STATION_KEYS.indexOf(station);
    if (hasMine()) {   // G1712: the player's folder joins the cycle, after the mix
      const K = STATION_KEYS.concat([ST_MINE]), j = K.indexOf(station);
      return setStation(K[j < 0 ? K.indexOf(ST_DEFAULT) : (j + d + K.length) % K.length]);
    }
    return setStation(STATION_KEYS[i < 0 ? STATION_KEYS.indexOf(ST_DEFAULT) : (i + d + n) % n]);
  }
  const labelOf = s => (s === 'off' ? 'radio off' : s === ST_MINE ? MINE_LABEL + (mineName ? ' (' + mineName + ')' : '') : (STATIONS.find(r => r[0] === s) || [s, s])[1]);
  // the picker's words for a station: its label, and the fallback when it has no track yet
  const stationLine = s => labelOf(s) + (s !== 'off' && stationLists(cat, s).empty && s !== ST_DEFAULT ? ' — no tracks yet, plays ' + labelOf(ST_DEFAULT) : '');
  // the keys [ and ]: free in input.js's ACTIONS; yielded to a profile that binds them, to a modifier, to a text field
  function keyBound(code) {
    try {
      const I = G.FLYDIY_INPUT, p = I && I.profile && I.profile(), b = p && p.bindings;
      if (b) for (const id in b) for (const x of b[id] || []) if (x && (x.code === code || x.pos === code || x.neg === code || x.max === code || x.min === code)) return true;
    } catch (e) {}
    return false;
  }
  function onKey(e) {
    if (!e || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    if (e.code !== 'BracketLeft' && e.code !== 'BracketRight') return;
    const tg = e.target;
    if (tg && typeof tg.closest === 'function' && tg.closest('input, select, textarea, [contenteditable]')) return;
    if (keyBound(e.code)) return;
    stepStation(e.code === 'BracketRight' ? 1 : -1);
  }

  // the element events (made once per element, on connect): the clocks into typed slots, the end, a failure
  function onTime(k) { const el = decks[k].el, v = +el.currentTime; if (v === v) DK[k * K_N + K_POS] = v; }
  function onDur(k) { const el = decks[k].el, v = +el.duration; if (v > 0 && v < 1e6) { DK[k * K_N + K_DUR] = v; const t = DK[k * K_N + K_TRACK]; if (t >= baseN && cat[t]) cat[t].durationS = v; } }
  function onEnded(k) {
    const st = DK[k * K_N + K_STATE], was = PS[S_ACT] === k;
    release(k);
    if (st !== ST_PLAYING || !was) return;
    const c = PS[S_CUR];
    if (c < 0) return;
    if (gap(c)) { if (!nextWithTalk(c)) PS[S_GAP] = GAP_MIN_S + rand() * (GAP_MAX_S - GAP_MIN_S); }   // (a break takes the silence's place)
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
    cancelTalk();   // a talk break never under an engine start or a stall warning
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
    const want = station === 'off' ? C_NONE : contextOf(au.welcome, PS[S_PHOTO] > 0, garage, au.get('musicGarage'), au.get('musicFlight'), cruise, au.get('musicLoading'));
    if (want !== PS[S_CUR]) switchTo(want);
    if (panner) { PS[S_PANT] -= dt; if (PS[S_PANT] <= 0) { PS[S_PANT] = PAN_EVERY_S; lean(au); } }   // G1714 (4 Hz)
    if (au.state === 'suspended') return;   // the timers wait with the sound
    for (let k = 0; k < 2; k++) {
      const o = k * K_N;
      if (DK[o + K_STOP] >= 0) { DK[o + K_STOP] -= dt; if (DK[o + K_STOP] <= 0) release(k); }
    }
    if (PS[S_DUCK] > 0) { PS[S_DUCK] -= dt; if (PS[S_DUCK] <= 0) unDuck(); }
    if (PS[S_NOW] > 0) { PS[S_NOW] -= dt; if (PS[S_NOW] <= 0) hideNow(); }
    if (PS[S_TALK] > 0) { PS[S_TALK] -= dt; if (PS[S_TALK] <= 0) { if (speaker) speaker.cancel(true); endTalk(); } }   // the watchdog
    const c = PS[S_CUR];
    if (c < 0) return;
    if (PS[S_RETRY] > 0) { PS[S_RETRY] -= dt; if (PS[S_RETRY] <= 0) { PS[S_RETRY] = 0; startNext(c, 0); } return; }
    const a = PS[S_ACT];
    if (gap(c)) {
      if (PS[S_GAP] >= 0) {
        PS[S_GAP] -= dt;
        if (PS[S_GAP] <= LEAD_S) preloadNext(c);
        if (PS[S_GAP] <= 0) { PS[S_GAP] = -1; startNext(c, 0); }
      } else if (a < 0) startNext(c, 0);   // nothing playing, no gap running (a failed start, a skip into silence)
      return;
    }
    if (a < 0) { startNext(c, XFADE_S); return; }
    const o = a * K_N, rem = DK[o + K_DUR] - DK[o + K_POS], xf = Math.min(XFADE_S, DK[o + K_DUR] / 4);   // (a short track: a shorter fade)
    // G1703: a break owed starts earlier, over the outro (talkDue is asked only in the track's last seconds: no frame cost)
    const up = rem <= TALK_UP_S + LEAD_S && station === ST_TALK && talkDue() ? Math.min(TALK_UP_S, DK[o + K_DUR] / 3) : 0;
    const lead = up > xf ? up : xf;
    if (rem <= lead + LEAD_S) preloadNext(c);
    if (rem <= lead) { C.xfades++; const d = rem > xf ? rem : xf; fadeOut(a, d); if (!nextWithTalk(c)) startNext(c, d); }
  }

  // G1714: the side the radio is on, from the listener (the camera's right axis, its world matrix: no allocation)
  function lean(au) {
    let x = 0;
    const cam = au.camera, m = cam && cam.matrixWorld && cam.matrixWorld.elements;
    if (SRC[3] > 0 && au.inGarage && m) {
      const dx = SRC[0] - m[12], dy = SRC[1] - m[13], dz = SRC[2] - m[14], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 1e-3) {
        const near = Math.max(0, Math.min(1, (PAN_FAR - d) / (PAN_FAR - PAN_NEAR)));
        x = PAN_K * near * (m[0] * dx + m[1] * dy + m[2] * dz) / d;
      }
    }
    if (Math.abs(x - SRC[4]) < PAN_STEP && !(x === 0 && SRC[4] !== 0)) return;
    SRC[4] = x;
    const p = panner.pan;
    if (p.setTargetAtTime) p.setTargetAtTime(x, ctx.currentTime, PAN_TAU); else p.value = x;
  }
  function setSourcePos(x, y, z) {
    if (x == null) { SRC[3] = 0; return; }
    SRC[0] = +x || 0; SRC[1] = +y || 0; SRC[2] = +z || 0; SRC[3] = 1;
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
  function makeNowEl(D) {
    nowEl = D.createElement('div');
    nowEl.id = 'musicNow';
    nowEl.setAttribute('aria-live', 'polite');
    nowEl.style.cssText = 'position:fixed;left:calc(var(--ws-left, 0px) + 22px);bottom:18px;z-index:41;pointer-events:none;' +
      'font:12px/1.4 inherit;letter-spacing:.02em;color:rgba(235,232,224,.82);text-shadow:0 1px 3px rgba(0,0,0,.6);' +
      'opacity:0;transition:opacity 1.2s ease;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    D.body.appendChild(nowEl);
  }
  function showNow(t) { showLine('♪ ' + nows[t]); }
  // the line for NOW_S (a track's start in the garage, a station switch anywhere)
  function showLine(text) {
    const D = G.document;
    if (!D || !D.createElement || !D.body) return;
    if (!nowEl) makeNowEl(D);
    nowEl.textContent = text;
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
    const rows = creditRows(cat.slice(0, baseN));   // (G1712: the player's own files are not ours to credit)
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
    // G1714: duck -> the lean -> the bus (a context with no StereoPanner: straight on, as before)
    panner = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
    if (panner) { panner.pan.value = 0; duck.connect(panner); panner.connect(au.bus('music')); } else duck.connect(au.bus('music'));
    SRC[4] = 0; PS[S_PANT] = 0;
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
    PS[S_CUR] = C_NONE; PS[S_ACT] = -1; PS[S_GAP] = -1; PS[S_DUCK] = 0; PS[S_BED] = 1; PS[S_TALK] = 0;
    // the radio's voice and keys: made here, on the gesture (nothing is spoken before one)
    // G1683: the talker plays a segment's recorded clips (AUDIO_VOICE) when they all exist, else speaks it; the clips
    // pass radioIn -> the duck -> the music bus, so the music's ducks, its volume and the context's suspend reach them
    radioIn = c.createGain(); radioIn.gain.value = clipK(); radioIn.connect(duck);
    const RT = typeof G.RADIO_TALK !== 'undefined' ? G.RADIO_TALK : null;
    speaker = RT ? (RT.makeTalker ? RT.makeTalker(G, voiceApi) : RT.makeSpeaker(G)) : null;
    if (G.addEventListener) G.addEventListener('keydown', onKey);
    if (station === ST_TALK) PS[S_TUNE] = 1;   // the first music of the page on the roots station opens with its ID
    if (RT && RT.cursor) CUR = RT.cursor(G);   // G1702: the broadcast continues where the last session left it
    loadScript();
    offs = [au.onEvent('engine', onDuck), au.onEvent('stall', onDuck), au.onEvent('duck', onDuck),
      au.onEvent('photo', on => setPhoto(on)),
      au.onEvent('suspend', () => { cancelTalk(); for (let k = 0; k < 2; k++) if (DK[k * K_N + K_STATE] >= ST_PLAYING) { DK[k * K_N + K_PAUSED] = 1; try { decks[k].el.pause(); } catch (e) {} } }),
      au.onEvent('resume', () => { for (let k = 0; k < 2; k++) if (DK[k * K_N + K_PAUSED]) { DK[k * K_N + K_PAUSED] = 0; try { const r = decks[k].el.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {} } })];
  }
  function disconnect() {
    for (const f of offs) { try { f(); } catch (e) {} }
    offs = [];
    if (speaker) speaker.cancel(true);
    speaker = null; PS[S_BED] = 1; PS[S_TALK] = 0;
    try { if (radioIn) radioIn.disconnect(); } catch (e) {}
    radioIn = null;
    if (G.removeEventListener) G.removeEventListener('keydown', onKey);
    for (let k = 0; k < decks.length; k++) {
      release(k);
      const d = decks[k];
      for (const ev in d.h) d.el.removeEventListener(ev, d.h[ev]);
      try { d.src.disconnect(); d.gain.disconnect(); } catch (e) {}
    }
    decks = [];
    try { if (duck) duck.disconnect(); } catch (e) {}
    try { if (panner) panner.disconnect(); } catch (e) {}
    panner = null;
    duck = null; ctx = null; A = null;
    PS[S_CUR] = C_NONE; PS[S_ACT] = -1;
    hideNow();
  }
  function setPhoto(on) { PS[S_PHOTO] = on ? 1 : 0; }

  // ---- G1712 MY MUSIC: the player's files in, the station's lists, the decks that held the old ones let go ----------
  const hasMine = () => cat.length > baseN;
  // the 'station' event (AUDIO's bus of events: the quick bar and the boombox repaint); before the gesture AUDIO keeps the
  // handlers all the same
  function tell() { const AU = G.AUDIO; if (AU && AU.emit) AU.emit('station', station); }
  // a title from a file name: no extension, no leading track number, separators as spaces
  const titleOf = n => String(n).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/^\s*\d{1,3}\s*[-._)]\s*/, '').replace(/[_]+/g, ' ').trim() || String(n);
  // files: File / Blob-likes with a name (my_music.js's list); name: the folder's. Returns how many it kept.
  function setUserTracks(files, name) {
    const list = Array.prototype.slice.call(files || []).filter(f => f && typeof f.name === 'string' && MINE_RE.test(f.name));
    for (let k = 0; k < decks.length; k++) if (DK[k * K_N + K_TRACK] >= baseN) release(k);   // (their URLs revoked)
    for (let c = 0; c < 4; c++) if (RESUME_T[c] >= baseN) RESUME_T[c] = -1;
    for (let i = 0; i < 2; i++) if (REC[i] >= baseN) REC[i] = -1;
    const old = bad;
    cat = cat.slice(0, baseN).concat(list.map((f, i) => ({ id: 'mine' + i, file: '', title: titleOf(f.name), artist: name || MINE_LABEL,
      album: '', licence: 'your own file', source: '', station: ST_MINE, contexts: CTX_NAMES.slice(), durationS: 0, user: 1, blob: f })));
    urls = urls.slice(0, baseN).concat(list.map(() => ''));
    const tr = new Float64Array(cat.length); tr.set(trims.subarray(0, baseN)); tr.fill(1, baseN); trims = tr;
    nows = nows.slice(0, baseN).concat(cat.slice(baseN).map(nowLine));
    bad = new Uint8Array(cat.length); bad.set(old.subarray(0, baseN));
    delete bagsBy[ST_MINE];
    mineName = list.length ? String(name || '') : '';
    if (station === ST_MINE) {
      if (!list.length) { setStation(prevStation === ST_MINE ? ST_START : prevStation); return 0; }
      rebuildLists();
      JOIN = 1; PS[S_GAP] = -1;
      const c = PS[S_CUR];
      if (ctx && c >= 0 && PS[S_ACT] < 0) startNext(c, 0);
    } else if (wantMine && list.length) setStation(ST_MINE);
    tell();
    return list.length;
  }

  setCatalogue(G.FLYDIY_MUSIC || []);
  const api = {
    CTX_NAMES, CRUISE, XFADE_S, GAP_MIN_S, GAP_MAX_S, DUCK_K, DUCK_HOLD_S, LUFS_TARGET, SOUND_CREDITS, FILE_RE, LICENCE_RE,
    validate, contextLists, creditRows, creditLine, cruiseStep, contextOf, makeBag, bagNext, trimOf,
    STATIONS, STATION_KEYS, ST_MIX, BED_K, BED_IN_S, BED_UP_S, VOICE_K, TALK_EVERY, TALK_UP_S, stationLists, stationOf, stationLine,
    setStation, stepStation, get station() { return station; },
    setSourcePos, get pan() { return SRC[4]; }, PAN_K, PAN_NEAR, PAN_FAR, ST_MINE, MINE_RE, setUserTracks, titleOf, get hasMine() { return hasMine(); }, get mineCount() { return cat.length - baseN; }, get mineName() { return mineName; }, labelOf,
    // the station a radio turned back on plays: the last one that was on (the folder's only while it is there)
    get lastStation() { return lastOn === ST_MINE && !hasMine() ? (prevStation !== 'off' ? prevStation : ST_START) : (STATION_KEYS.indexOf(lastOn) >= 0 || lastOn === ST_MINE ? lastOn : ST_START); }, get stationFell() { return fell.slice(); },
    get talk() { return talkOn; }, setTalk(on) { talkOn = !!on; prefPut('radioTalk', talkOn ? 1 : 0); if (!talkOn) cancelTalk(); },
    get talkEvery() { return talkEvery; }, setTalkEvery(n) { talkEvery = Math.max(TALK_MIN, Math.min(TALK_MAX, Math.round(+n) || TALK_EVERY)); prefPut('radioEvery', talkEvery); },
    get voice() { return voiceName; }, setVoice(n) { voiceName = String(n || ''); prefPut('radioVoice', voiceName); },
    get talking() { return PS[S_TALK] > 0; }, cancelTalk, get talker() { return speaker; }, get radioIn() { return radioIn; }, clipK, VOICE_LUFS,
    seed(n) { RNG[0] = (n >>> 0) || 1; }, setJoin(on) { JOIN_ON = on ? 1 : 0; }, get joinRange() { return [JOIN_MIN, JOIN_MAX]; }, setCatalogue, get catalogue() { return cat; },
    skip, setPhoto, openCredits, mountCreditLink, nowPlaying,
    get context() { return PS[S_CUR] >= 0 ? CTX_NAMES[PS[S_CUR]] : 'none'; },
    // the gate's window on the slots (read-only views)
    _dk: DK, _ps: PS, _C: C, _decks: () => decks, _lvlAt: lvlAt, _talkSt: () => CUR, _lastSegs: () => lastSegs, source: { connect, update, disconnect },
  };

  // THE LOADING SCREENS' BUTTON (the user, 2026-10-05: "a piece of UI there to turn the music on and off. And off by
  // default for now"): #bootMusic on BOOT's panel drives AUDIO's 'musicLoading' both ways. The press is itself the
  // gesture that unlocks the sound; turning it on with the radio off brings back the start station. While a loading
  // song plays, the button names it. With ?audio=0 (AUDIO a stub) the button stays hidden.
  function mountBootMusic(AU) {
    const D = G.document, b = D && D.getElementById && D.getElementById('bootMusic');
    if (!b) return false;
    const paint = () => {
      const on = AU.get('musicLoading') === 1, np = on && PS[S_CUR] === C_WELCOME ? nowPlaying() : null;
      if (b.classList) b.classList.toggle('on', on);
      b.textContent = on ? (np ? '\u266A ' + np.title + ' \u2014 ' + np.artist : '\u266A music on') : '\u266A music off';
      b.title = 'Music while loading: ' + (on ? 'on (press to turn it off)' : 'off (press to turn it on)');
    };
    b.hidden = false;   // shown: the sound is built
    b.onclick = () => {
      const on = AU.get('musicLoading') ? 0 : 1;
      if (on && station === 'off') setStation(ST_START, true);
      AU.set('musicLoading', on); paint();
    };
    AU.onEvent('settings', paint); AU.onEvent('music', paint); AU.onEvent('station', paint);
    paint();
    return true;
  }

  mountCreditLink();
  const AU = G.AUDIO;
  if (AU && AU.enabled) {
    AU.addSource('music', api.source);
    mountBootMusic(AU);
    if (AU.addRows) AU.addRows((body, kit, toggle) => {
      const np = nowPlaying();
      if (kit.note) kit.note(body, np ? 'Now playing: ' + nowLine(np) : (cat.length ? 'No music playing.' : 'No music ships yet.'));
      const D = G.document;
      const btn = (label, text, fn) => { const r = kit.row(body, label), b = D.createElement('button'); b.textContent = text; b.className = 'pill'; b.onclick = fn; r.appendChild(b); return r; };
      // G1676 THE RADIO: the station, Radio Jolene's talk and its voice
      const pick = (label, opts, cur, fn) => {
        const r = kit.row(body, label), sel = D.createElement('select');
        for (const [v, t] of opts) { const o = D.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
        sel.value = cur; sel.onchange = () => fn(sel.value); r.appendChild(sel); return sel;
      };
      pick('station', STATION_KEYS.concat(['off']).map(k => [k, stationLine(k)]).concat(hasMine() ? [[ST_MINE, stationLine(ST_MINE)]] : []), station, v => setStation(v));
      toggle('Radio Jolene talk', () => talkOn, on => api.setTalk(on));
      kit.range(body, 'talk every', TALK_MIN, TALK_MAX, 1, () => talkEvery, v => api.setTalkEvery(v), v => v + (v === 1 ? ' track' : ' tracks'));
      const vs = speaker ? speaker.voices() : [];
      const vo = [['', 'automatic (' + (G.RADIO_TALK ? G.RADIO_TALK.PREFERRED_VOICE : 'Microsoft George').replace(/ - .*/, '') + ' when present)']]
        .concat(vs.filter(v => /^en/i.test(v.lang || '')).map(v => [v.name, v.name]));
      if (voiceName && !vo.some(o => o[0] === voiceName)) vo.push([voiceName, voiceName + ' (not on this system)']);
      pick('voice', vo, voiceName, v => api.setVoice(v));
      btn('skip track', 'skip', () => skip());
      btn('music credits', 'open', () => openCredits());
    });
  }
  return api;
})();
if (typeof window !== 'undefined') window.AUDIO_MUSIC = AUDIO_MUSIC;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_MUSIC;
