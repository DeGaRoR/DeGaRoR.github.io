// ============================================================
// THE SAMPLE SLOTS (G1632, SND-AIRFRAME; SOUND-2026-10-04 §2.4 / §3.5 / §7).
// window.AUDIO_SAMPLES - a tiny manifest-driven loader for the recorded grains
// that BLEND INTO a procedural layer (every layer sounds without its sample).
//
//   THE KEYS     AUDIO_SAMPLES.KEYS below: the declared slots, each with its
//                kind (loop / one-shot), the layer it blends into and what the
//                recording should be. A key with no file is simply absent.
//   THE MANIFEST window.FLYDIY_AUDIO_MEDIA = { key: [url, ...] } - written by the
//                coordinator's tools/audio/prep.js (the shipped files under
//                media/audio/, content-hashed through _media_lib, MP3, mono);
//                each url is prefixed with FLYDIY_ASSET_BASE (the baked
//                manifests' rule). Nothing ships today: every key is absent.
//   LAZY         nothing is fetched or decoded before load(key) is asked, and
//                load is only asked after the gesture (a source's connect /
//                update): ASSET_FETCH (assets.js, the one network door) ->
//                ctx.decodeAudioData. Two asks share one load; a failure stays
//                failed (no retry storm, assets.js's rule).
//   BUDGETED     decoded bytes (frames x channels x 4) under `budget` (default
//                6 MB for the airframe's grains; §2.4's ambience has its own);
//                a key that would pass it is refused, said once.
//   PLAYERS      loop(key, dest) - ONE AudioBufferSourceNode looping a buffer
//                whose equal-power crossfade (1-2 s, §2.4: never at a codec seam)
//                is BAKED ONCE at decode, so a loop never re-schedules and a
//                steady frame touches nothing; a leading / trailing codec pad
//                (|x| < 1e-4, <= 50 ms) is trimmed first. oneShot(key, outs,
//                gain) - a random variant, pitch +-jitter semitones, gain
//                +-jitter dB, to each [node, gain] of outs.
//
// API: AUDIO_SAMPLES.attach(ctx, opts?) (the source's connect), .load(key) ->
//   Promise<AudioBuffer | null> (the first variant; all are loaded), .ready(key),
//   .state(key) 'absent' | 'idle' (files, not asked) | 'loading' | 'ready' | 'failed' | 'budget',
//   .pick(key) a random variant (sync, null until ready), .loop(key, dest),
//   .oneShot(key, outs, gain, jitter?), .bytes, .detach(); AUDIO_SAMPLES.create(opts)
//   makes an independent instance (GATE AUDIO's stubs).
// ============================================================
var AUDIO_SAMPLES = (function () {
  'use strict';
  // THE DECLARED SLOTS: kind, the layer they blend into, what the recording is. SND-ASSETS fills them.
  const KEYS = {
    'gnd.grass':    { kind: 'loop', layer: 'ground (row 0 grass)', what: 'a tyre rolling on mown grass, 10-20 km/h, no engine' },
    'gnd.gravel':   { kind: 'loop', layer: 'ground (rows 6 gravel, 2 scree)', what: 'tyres on loose gravel, the crunch' },
    'gnd.asphalt':  { kind: 'loop', layer: 'ground (row 5 paved)', what: 'a tyre on asphalt / concrete, the hum' },
    'gnd.dirt':     { kind: 'loop', layer: 'ground (rows 1 rock, 3 forest floor, 7 sand)', what: 'a tyre on dirt / packed earth' },
    'gnd.rattle':   { kind: 'loop', layer: 'the tailwheel rattle', what: 'a small wheel rattling on a rough strip' },
    'gnd.thump':    { kind: 'oneshot', layer: 'touchdown / suspension', what: 'a tyre landing, a strut bottoming (dry, close)' },
    'gnd.squeal':   { kind: 'oneshot', layer: 'the tyre chirp', what: 'a tyre spinning up on concrete (a landing chirp)' },
    'gnd.brake':    { kind: 'loop', layer: 'the brake squeal', what: 'a disc brake squealing at walking pace' },
    'water.spray':  { kind: 'loop', layer: 'the spray hiss', what: 'a boat hull at speed, spray' },
    'water.slap':   { kind: 'oneshot', layer: 'float / hull slaps', what: 'a wave slapping a hull, single' },
    'water.splash': { kind: 'oneshot', layer: 'water touch / entry', what: 'a heavy splash' },
    'mech.switch':  { kind: 'oneshot', layer: 'the panel (later)', what: 'a toggle switch click' },
    'mech.lever':   { kind: 'oneshot', layer: 'the manual flap lever', what: 'a lever ratchet and clunk' },
    'mech.flap':    { kind: 'loop', layer: 'the electric flap motor', what: 'a small DC motor running' },
    'mech.creak':   { kind: 'oneshot', layer: 'airframe creaks', what: 'a wooden / tubular structure creaking' },
    'mech.rattle':  { kind: 'oneshot', layer: 'airframe rattles', what: 'a loose panel / buckle rattling once' },
    'stall.reed':   { kind: 'loop', layer: 'the reed stall horn', what: 'a Cessna stall horn sounding (steady part)' },
    'stall.buzzer': { kind: 'loop', layer: 'the electric stall warning', what: 'an electric stall horn' },
  };
  const DEF_BUDGET = 6 * 1024 * 1024;
  const W = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

  function create(opts) {
    const o = opts || {};
    let ctx = null;
    const recs = {};   // key -> { state, bufs, loopBuf, promise }
    let bytes = 0, said = false;
    const budget = o.budget > 0 ? o.budget : DEF_BUDGET;
    const rnd = o.random || Math.random;
    const manifest = () => o.manifest || W.FLYDIY_AUDIO_MEDIA || {};
    const base = () => (o.base != null ? o.base : (typeof W.FLYDIY_ASSET_BASE === 'string' ? W.FLYDIY_ASSET_BASE : ''));
    const fetchBytes = url => (o.fetch ? o.fetch(url) : W.ASSET_FETCH ? W.ASSET_FETCH(url)
      : Promise.reject(new Error('audio samples: no ASSET_FETCH for ' + url)));
    const urls = key => { const m = manifest()[key]; return Array.isArray(m) ? m : typeof m === 'string' ? [m] : []; };
    const rec = key => recs[key] || (recs[key] = { state: urls(key).length ? 'idle' : 'absent', bufs: null, loopBuf: null, promise: null });

    function decode(u8) {
      // decodeAudioData DETACHES its ArrayBuffer: hand it a copy of exactly the bytes
      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      return new Promise((res, rej) => {
        const p = ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }
    const sizeOf = b => b.length * b.numberOfChannels * 4;

    function load(key) {
      if (!ctx) return Promise.resolve(null);
      const r = rec(key);
      if (r.state === 'absent') return Promise.resolve(null);
      if (r.promise) return r.promise;
      r.state = 'loading';
      const B = base();
      r.promise = Promise.all(urls(key).map(u => fetchBytes(B + u).then(decode))).then(bufs => {
        const add = bufs.reduce((s, b) => s + sizeOf(b), 0);
        if (bytes + add > budget) {
          r.state = 'budget';
          if (!said) { said = true; console.info('flyDiy audio: the sample ' + key + ' would pass the ' + Math.round(budget / 1048576) + ' MB budget; its layer stays procedural'); }
          return null;
        }
        bytes += add;
        r.bufs = bufs; r.state = 'ready';
        if (KEYS[key] && KEYS[key].kind === 'loop') { r.loopBuf = bakeLoop(bufs[0]); bytes += sizeOf(r.loopBuf); }
        return bufs[0];
      }, e => { r.state = 'failed'; console.warn('flyDiy audio: the sample ' + key + ' did not load; its layer stays procedural', e); return null; });
      return r.promise;
    }

    // THE LOOP, baked once: the codec's pads trimmed, then the tail crossfaded (equal power) into the head
    function bakeLoop(b) {
      const sr = b.sampleRate, ch = b.numberOfChannels, L = b.length;
      const padMax = Math.floor(0.05 * sr);
      let a = 0, z = L;
      const d0 = b.getChannelData(0);
      while (a < padMax && a < L && Math.abs(d0[a]) < 1e-4) a++;
      while (L - z < padMax && z > a && Math.abs(d0[z - 1]) < 1e-4) z--;
      const len = z - a;
      const X = Math.max(1, Math.min(Math.floor(1.5 * sr), Math.floor(len / 4)));
      const M = len - X;
      if (M < 64) return b;   // too short to loop with a fade: as it is
      const out = ctx.createBuffer(ch, M, sr);
      for (let c = 0; c < ch; c++) {
        const src = b.getChannelData(c), dst = out.getChannelData(c);
        for (let i = 0; i < M; i++) dst[i] = src[a + i];
        for (let i = 0; i < X; i++) {
          const t = (i + 0.5) / X;
          dst[i] = src[a + i] * Math.sin(0.5 * Math.PI * t) + src[a + M + i] * Math.cos(0.5 * Math.PI * t);
        }
      }
      return out;
    }

    // a looping player: buffer source -> its own gain -> dest (the caller ramps .gain and .rate)
    function loop(key, dest) {
      const r = rec(key);
      if (!ctx || r.state !== 'ready' || !r.loopBuf) return null;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = r.loopBuf; src.loop = true;
      g.gain.value = 0;
      src.connect(g); if (dest) g.connect(dest);
      // a random start, so two loops of one file never phase
      src.start(ctx.currentTime, rnd() * r.loopBuf.duration);
      return { key, src, gain: g.gain, rate: src.playbackRate, out: g,
               stop() { try { src.stop(); } catch (e) {} try { src.disconnect(); g.disconnect(); } catch (e) {} } };
    }

    // a one-shot: a random variant, pitch +-jit.semi semitones, gain +-jit.db dB, to each [node, gain] of outs
    function oneShot(key, outs, gain, jit) {
      const r = rec(key);
      if (!ctx || r.state !== 'ready' || !r.bufs || !r.bufs.length) return false;
      const j = jit || {}, semi = j.semi != null ? j.semi : 1.5, db = j.db != null ? j.db : 2;
      const b = r.bufs[Math.min(r.bufs.length - 1, Math.floor(rnd() * r.bufs.length))];
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = Math.pow(2, (2 * rnd() - 1) * semi / 12);
      const k = (gain == null ? 1 : gain) * Math.pow(10, (2 * rnd() - 1) * db / 20);
      for (const [node, gi] of outs) {
        const g = ctx.createGain(); g.gain.value = k * gi;
        src.connect(g); g.connect(node);
      }
      src.start(ctx.currentTime);
      return true;
    }

    const api = {
      KEYS,
      attach(c) { ctx = c; return api; },
      detach() { ctx = null; for (const k in recs) delete recs[k]; bytes = 0; said = false; },
      load,
      state: key => rec(key).state,
      ready: key => rec(key).state === 'ready',
      has: key => urls(key).length > 0,
      pick(key) { const r = rec(key); return r.state === 'ready' && r.bufs.length ? r.bufs[Math.floor(rnd() * r.bufs.length)] : null; },
      loop, oneShot, bakeLoop: b => bakeLoop(b),
      get bytes() { return bytes; }, budget,
    };
    return api;
  }

  const main = create();
  main.create = create;
  return main;
})();
if (typeof window !== 'undefined') window.AUDIO_SAMPLES = AUDIO_SAMPLES;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_SAMPLES;
