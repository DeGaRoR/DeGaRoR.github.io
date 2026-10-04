// ============================================================
// RADIO JOLENE'S VOICE - THE PLAYER (G1627, SND-VOICE; SOUND-2026-10-04 ruling s12).
// window.AUDIO_VOICE - plays the station's recorded clips, alone or as a SEQUENCE (VOICE_MODEL.awosClips /
// marineClips / backAnnounce: clip keys and rests in seconds), scheduled gap-free on the audio clock.
//
//   THE CATALOGUE window.FLYDIY_VOICE = { voice: {the licence record}, clips: { key: { file, text, dur } } } -
//                 src/viewer/audio/voice_catalogue.json, written by tools/audio/prep_voice.js, inlined by the build
//                 (never fetched, so never stale under sw.js's cache-first media rule). file is page-relative
//                 (media/audio/voice/<stem>.<h8>.mp3), prefixed with FLYDIY_ASSET_BASE like every baked manifest.
//   LAZY          nothing fetched or decoded until a clip is asked for (play / preload), and only with a context -
//                 so never before the first gesture (AUDIO.ctx is null until then). ASSET_FETCH (assets.js, the one
//                 network door) -> decodeAudioData. Two asks share one load; a failure stays failed.
//   GAP-FREE      every MP3 starts with the encoder's pad (lamejs writes no LAME tag, so a decoder cannot trim it):
//                 at decode the clip's first sample above PAD_FLOOR (minus 5 ms) is its offset, and a source plays
//                 [offset, offset + dur] - dur is the catalogue's, the speech as rendered. VOICE_MODEL.timeline lays
//                 the clips end to end with the sequence's rests; each source is start()ed at its slot, sample-exact.
//   BUDGETED      decoded bytes (frames x channels x 4) under `budget` (default 6 MB: an AWOS reading is ~25 s of
//                 clips, ~5 MB at 48 kHz); the least recently used clips not playing are dropped past it.
//   THE BUS       opts.dest, else AUDIO.bus('radio') (SND-RADIO's, when it lands), else AUDIO.bus('ui'). Radio Jolene's
//                 breaks pass music.js's radio gain (G1683: into the music's duck, then the music bus).
//   THE END       opts.onend(handle), once: when the last clip ends, or stop() (G1683: the talker's next segment).
//
// API: AUDIO_VOICE.has(key), .dur(key), .text(key), .keyOf(text) (a script line -> its clip key: SND-RADIO's segments
//   are data), .missing(seq) -> keys with no clip, .preload(seq) -> Promise, .play(seq, { dest, when, gain, onend }) ->
//   Promise<{ start, end, stop() } | null> (null: no context yet, or nothing playable), .say(key, opts), .stopAll(),
//   .bytes, .state(key) 'absent' | 'idle' | 'loading' | 'ready' | 'failed'; AUDIO_VOICE.create(opts) makes an
//   independent instance (GATE AUDIO's stubs: opts.ctx, .catalogue, .fetch, .base, .budget, .model).
// ============================================================
var AUDIO_VOICE = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  const PAD_FLOOR = 1e-3, PAD_MAX_S = 0.15, LEAD_S = 0.005, DEF_BUDGET = 6 * 1024 * 1024;
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function create(opts) {
    const o = opts || {};
    const cat = () => o.catalogue || W.FLYDIY_VOICE || { clips: {} };
    const clips = () => cat().clips || {};
    const model = () => o.model || W.VOICE_MODEL || (typeof VOICE_MODEL !== 'undefined' ? VOICE_MODEL : null);
    const base = () => (o.base != null ? o.base : (typeof W.FLYDIY_ASSET_BASE === 'string' ? W.FLYDIY_ASSET_BASE : ''));
    const ctxOf = () => o.ctx || (W.AUDIO && W.AUDIO.ctx) || null;
    const fetchBytes = url => (o.fetch ? o.fetch(url) : W.ASSET_FETCH ? W.ASSET_FETCH(url)
      : Promise.reject(new Error('audio voice: no ASSET_FETCH for ' + url)));
    const budget = o.budget > 0 ? o.budget : DEF_BUDGET;
    const recs = new Map();   // key -> { state, promise, buf, off, size, used, playing }
    const live = new Set();   // the handles playing
    let bytes = 0, tick = 0, byText = null, said = false;

    const has = k => !!clips()[k];
    const durOf = k => (clips()[k] ? +clips()[k].dur || 0 : 0);
    function keyOf(text) {
      if (!byText) { byText = new Map(); const c = clips(); for (const k in c) byText.set(norm(c[k].text), k); }
      return byText.get(norm(text)) || null;
    }
    const missing = seq => (seq || []).filter(s => typeof s === 'string' && !has(s));

    // the codec pad: the first sample above the floor (within PAD_MAX_S), less a 5 ms lead
    function onset(buf) {
      const x = buf.getChannelData(0), sr = buf.sampleRate, n = Math.min(x.length, Math.round(PAD_MAX_S * sr));
      for (let i = 0; i < n; i++) if (Math.abs(x[i]) > PAD_FLOOR) return Math.max(0, i / sr - LEAD_S);
      return 0;
    }
    function evict() {
      if (bytes <= budget) return;
      const idle = [...recs.entries()].filter(([, r]) => r.state === 'ready' && !r.playing).sort((a, b) => a[1].used - b[1].used);
      for (const [k, r] of idle) { if (bytes <= budget) break; bytes -= r.size; recs.delete(k); }
      if (bytes > budget && !said) { said = true; if (W.console) W.console.warn('audio voice: playing past the ' + (budget >> 20) + ' MB budget'); }
    }
    function load(key) {
      const r0 = recs.get(key);
      if (r0) { r0.used = ++tick; return r0.promise; }
      const c = clips()[key], ctx = ctxOf();
      if (!c || !ctx) return Promise.resolve(null);
      const r = { state: 'loading', promise: null, buf: null, off: 0, size: 0, used: ++tick, playing: 0 };
      recs.set(key, r);
      r.promise = fetchBytes(base() + c.file).then(u8 => {
        const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);   // decodeAudioData detaches it
        return new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      }).then(buf => {
        if (recs.get(key) !== r) return null;
        r.buf = buf; r.off = onset(buf); r.size = buf.length * buf.numberOfChannels * 4; r.state = 'ready';
        bytes += r.size;   // evicted after a play is scheduled (its clips pinned) or a preload settles
        return r;
      }, e => { r.state = 'failed'; if (W.console) W.console.warn('audio voice: ' + key + ' - ' + (e && e.message || e)); return null; });
      return r.promise;
    }
    const loadAll = seq => Promise.all([...new Set((seq || []).filter(s => typeof s === 'string'))].map(load));
    const preload = seq => loadAll(seq).then(r => { evict(); return r; });

    async function play(seq, po) {
      const p = po || {}, ctx = ctxOf();
      if (!ctx) return null;
      const s = Array.isArray(seq) ? seq : [seq];
      await loadAll(s);
      const ready = k => { const r = recs.get(k); return r && r.state === 'ready' ? r : null; };
      // a clip that failed to load is skipped (its slot closes up); the rests stay
      const tl = model().timeline(s, k => (ready(k) ? Math.min(durOf(k), ready(k).buf.duration - ready(k).off) : 0));
      if (!tl.at.length) return null;
      const dest = p.dest || o.dest || (W.AUDIO && W.AUDIO.bus && (W.AUDIO.bus('radio') || W.AUDIO.bus('ui'))) || ctx.destination;
      const g = ctx.createGain(); g.gain.value = p.gain != null ? p.gain : 1; g.connect(dest);
      const t0 = Math.max(ctx.currentTime + 0.05, +p.when || 0), srcs = [];
      const h = { start: t0, end: t0 + tl.total, stop() {
        for (const x of srcs) { try { x.stop(); } catch (e) {} }
        finish();
      } };
      let done = false;
      const finish = () => { if (done) return; done = true; live.delete(h); for (const a of tl.at) { const r = recs.get(a.key); if (r) r.playing = Math.max(0, r.playing - 1); } try { g.disconnect(); } catch (e) {} evict();
        if (p.onend) { try { p.onend(h); } catch (e) {} } };   // G1683: the reading's end (its last clip, or stop())
      for (const a of tl.at) {
        const r = ready(a.key), src = ctx.createBufferSource();
        src.buffer = r.buf; src.connect(g); src.start(t0 + a.t, r.off, a.dur);
        r.playing++; r.used = ++tick; srcs.push(src);
      }
      srcs[srcs.length - 1].onended = finish;
      live.add(h);
      evict();
      return h;
    }
    return {
      has, dur: durOf, text: k => (clips()[k] ? clips()[k].text : null), keyOf, missing, preload, play,
      say: (k, po) => play([k], po),
      stopAll() { for (const h of [...live]) h.stop(); },
      state: k => (recs.get(k) ? recs.get(k).state : has(k) ? 'idle' : 'absent'),
      get bytes() { return bytes; },
      get voice() { return cat().voice || null; },
    };
  }
  const api = create();
  api.create = create;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_VOICE;
