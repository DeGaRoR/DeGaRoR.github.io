// ============================================================
// THE SOUND (G1600, SOUND-2026-10-04 §2): window.AUDIO - the context, the
// gesture unlock, the bus graph, the settings, the frame's update and the
// registration API every later SND-* session plugs into without touching
// app.js again.
//
//   NOTHING BEFORE A GESTURE   at load this file makes no AudioContext and no
//             node: it listens for the first pointerdown / keydown anywhere (the
//             game has no click-to-start) and builds everything inside that
//             handler (the browsers' autoplay rule asks the same).
//   ?audio=0  (or localStorage flydiy.audio = '0'; ?audio=1 outranks the pref)
//             builds NOTHING: no listener, no parameter block, no context.
//             AUDIO is then a stub whose update() returns at once - the A/B
//             switch for A0's rigs.
//   THE BUSES (§2.2)  sources -> aircraft.ext / aircraft.int -> aircraft ->
//             master; ambience, music, ui -> master; master -> fade -> soft
//             limiter (a DynamicsCompressor at -1 dBFS, fast attack) -> out.
//             `fade` is the silence's own gain: a hidden tab, the pause, an
//             unfocused window (the setting) ramp it to 0 over 0.2 s and the
//             context is suspended after; it resumes and ramps back on return.
//   THE FRAME AUDIO.update(sim, camera, dt, def, cam, inGarage, world) - one
//             call in app.js's loop, after the render. It fills ONE Float32
//             block (audio_params.js) and hands it to each source's update;
//             it allocates nothing and costs well under 0.3 ms (GATE AUDIO).
//   SETTINGS  six volumes (master, engine, airframe - its stored key 'aircraft' -, environment, music,
//             interface; G1722), mute when unfocused (on), headset (off), music in flight (off);
//   THE MIX   G1720-G1721: the measured trims out of the shed (MIX below; tools/audio/mix_render.js)
//             localStorage flydiy.audio.<key>, every access in try/catch.
//             AUDIO.mount(body, kit) draws them in either rail's own rows.
//
// THE API FOR THE SND-* SESSIONS
//   AUDIO.addSource(name, { connect(ctx, AUDIO), update(P, dt, AUDIO), disconnect() })
//        connect runs once the context exists (at once if it does); it makes the
//        source's nodes and connects them to AUDIO.bus(...). update runs every
//        frame with P = the parameter block (P.s[P.I.V], P.rpm[i], P.fireHz[i] ...).
//        It must not allocate: drive AudioParams (setTargetAtTime, tau ~ 0.03 s),
//        post a message only for a discrete event. A source that throws is
//        switched off and said in the console. Same name again = replaced.
//   AUDIO.bus(name)      'master' | 'aircraft' | 'aircraft.ext' | 'aircraft.int' |
//                        'ambience' | 'music' | 'ui' -> its GainNode (null before
//                        the gesture: use it inside connect)
//   AUDIO.module(stem)   ctx.audioWorklet.addModule of a served module, once ->
//                        a promise (window.FLYDIY_AUDIO_SRC[stem], the build's
//                        content-versioned URL, else src/viewer/audio/<stem>.js)
//   AUDIO.onEvent(type, fn) / AUDIO.emit(type, detail)   'ready' (the context
//                        made), 'suspend', 'resume', 'settings', 'perspective'
//                        (interior <-> exterior), and any a source declares
//   AUDIO.get(k) / AUDIO.set(k, v)   the settings (SETTINGS below)
//   AUDIO.params         the block (audio_params.js); AUDIO.stats the cost
//   AUDIO.world          the world update() was last handed (G1651: the ambience samples it around the listener)
// ============================================================
var AUDIO = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const PREF = 'flydiy.audio';
  const pref = (k, d) => { try { const v = W.localStorage && W.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const prefSet = (k, v) => { try { if (W.localStorage) W.localStorage.setItem(k, String(v)); } catch (e) {} };
  const query = (() => { try { return new URLSearchParams(W.location ? W.location.search : '').get('audio'); } catch (e) { return null; } })();
  const OFF = query === '0' || (query !== '1' && pref(PREF, '1') === '0');

  // THE SETTINGS: [key, default, kind, label, line, max (a volume's top, 1 when absent)]
  const SETTINGS = [
    ['master', 0.8, 'vol', 'master', 'everything'],
    // G1722 (SND-MIX, the user 2026-10-06: "a slider for the engine noise separately from the rest of the airplane"): the
    // engine and the propeller (every engine group's sources in space.js, outside and through the cabin and the headset; the
    // other aircraft's baked loops too); 'aircraft' (its stored key kept) is now the REST of the aeroplane - the airframe
    // G1728 (SND-MIX-2, the user 2026-10-13: "too faint... even at max"): the engine goes to 200 % (+6 dB) out of the shed
    // - the limiter stays clean there (mix_render: the loudest state, the cockpit climb, peaks under -1 dBFS at 200 %); the
    // garage holds it at 100 % (the shed stays as ruled)
    ['engine', 1.0, 'vol', 'engine', 'the engine and the propeller', 2],
    ['aircraft', 1.0, 'vol', 'airframe', 'the wind, the gear, the touchdown, the stall warning'],
    ['environment', 0.8, 'vol', 'environment', 'the wind, the birds, the sea, the shed'],
    ['music', 0.6, 'vol', 'music', ''],
    ['interface', 0.7, 'vol', 'interface', 'the clicks'],
    ['muteUnfocused', 1, 'bool', 'mute when unfocused', 'silent while another window has the focus'],
    ['headset', 0, 'bool', 'headset', 'in the cockpit, the way a pilot hears it: ~15 dB quieter'],
    ['musicFlight', 0, 'bool', 'music in flight', 'the music plays in the shed; in the air only with this on'],
    // the user, 2026-10-05: off by default "for now, for the dev process"; ON since AUDIO-ROBUST 3 (the user's official
    // performance table, 21 Nov: "Music and radio Jolene during loading screens" - audible, uninterrupted; A0 22 Nov: on by
    // default). The button on the loading screen (#bootMusic, music.js) still turns it off, and the choice is kept
    ['musicLoading', 1, 'bool', 'music while loading', 'a random song on every loading screen'],
    ['musicGarage', 0, 'bool', 'music in the garage', 'the shed\'s playlist, with silences between the tracks'],   // G1672 (music.js); OFF by default (the user, 2026-10-04: test sessions)
    // G1643 (SND-SPACE, space.js): the headset's kind, and the outside sounds placed for headphones
    ['headsetAnr', 0, 'bool', 'headset: noise cancelling', 'with the headset on: the active kind - the engine\'s drone goes first'],
    ['hrtf', 0, 'bool', '3D on headphones', 'the outside sounds placed for headphones (HRTF): heavier on the processor'],
  ];
  const DEF = {}, TOP = {}; for (const r of SETTINGS) { DEF[r[0]] = r[1]; TOP[r[0]] = r[5] > 0 ? r[5] : 1; }
  // G1722 A STORED 'aircraft' MUST NOT CHANGE WHAT A PLAYER HEARS: before the split it scaled the engine and the airframe
  // together. A player who set it and has no 'engine' yet gets the same value on BOTH (stored at once, so a later move of the
  // airframe row never drags the engine with it): the engine and the airframe stay exactly where they were.
  try {
    const ls = W.localStorage;
    if (ls && ls.getItem(PREF + '.engine') == null) { const a = ls.getItem(PREF + '.aircraft'); if (a != null && +a === +a) ls.setItem(PREF + '.engine', String(a)); }
  } catch (e) {}
  const readSetting = k => {
    const v = +pref(PREF + '.' + k, DEF[k]);
    return v === v ? (SETTINGS.find(r => r[0] === k)[2] === 'bool' ? (v ? 1 : 0) : Math.max(0, Math.min(TOP[k], v))) : DEF[k];
  };

  // the rows the menu draws (either rail's kit: row, range, toggle?, note)
  function mountRows(api, body, kit, stub) {
    const note = (t) => (kit.note ? kit.note(body, t) : null);
    const toggle = (label, get, set) => {
      if (kit.toggle) return kit.toggle(body, label, get, set);
      const r = kit.row(body, label), c = document.createElement('input');
      c.type = 'checkbox'; c.checked = !!get(); c.onchange = () => set(c.checked);
      r.appendChild(c); return r;
    };
    toggle('sound', () => !stub && api.state !== 'off', on => api.enable(on));
    if (stub) {
      note(query === '0' ? 'Sound is off for this page (?audio=0).'
                         : 'Sound is off. Switched on, it starts with the next page load.');
      return;
    }
    note(api.stateLine());
    for (const [k, , kind, label] of SETTINGS) {
      if (kind === 'vol') kit.range(body, label, 0, 100 * TOP[k], 1, () => Math.round(api.get(k) * 100), v => api.set(k, v / 100), v => v + ' %');
      else toggle(label, () => !!api.get(k), on => api.set(k, on ? 1 : 0));
    }
    // G1672: the rows a source adds (music.js: skip track, now playing), each in its own try
    for (const fn of api.rowHooks || []) { try { fn(body, kit, toggle); } catch (e) { console.warn('flyDiy audio: a settings row threw', e); } }
  }

  // ---- ?audio=0: NOTHING. A stub with the same surface, no listener, no block, no context -------------------
  if (OFF) {
    const stub = { enabled: false, state: 'off', ctx: null, params: null, stats: null,
      update() {}, bus() { return null; }, addSource() { return null; }, onEvent() {}, emit() {},
      module() { return Promise.resolve(false); }, get: k => readSetting(k), set() {}, lagS: null, space: null,
      stateLine: () => 'off', unlock() {}, addRows() {}, shutter: () => false, inGarage: false, welcome: false,
      stallTest: () => Promise.resolve(null), record: { start: () => Promise.resolve(false), stop: () => Promise.resolve(null) },
      enable(on) { if (on && query !== '0') prefSet(PREF, '1'); },
      mount(body, kit) { mountRows(stub, body, kit, true); } };
    return stub;
  }

  const AP = W.AUDIO_PARAMS || (typeof AUDIO_PARAMS !== 'undefined' ? AUDIO_PARAMS : null);
  // THE MIX (G1720-G1721, SND-MIX; the user's laptop test on train 36: "the engine sound is much too faint compared to all
  // other noises"). MEASURED, not guessed: tools/audio/mix_render.js renders the page's whole mix offline (the worklets, the
  // space, the beds and the emitters on Jolene, the radio) and reads every bus's LUFS - before these trims the airfield bed
  // was 15 dB OVER the idling engine outside, the radio 4-11 dB over the cruising engine. A real light aeroplane is 85-95
  // dBA in the cabin at cruise: the power plant leads at every setting, the wind a clear second, the world's ambience and
  // the animals under it (flavour from the ground). The trims, dB, OUT OF THE SHED only (the garage is unchanged: the user
  // ruled the shed faint; the roll-out shot keeps its own measured levels):
  //   engine     the engine sub-bus (the engine and the propeller, both perspectives) on top of the player's 'engine'
  //   interior   the aeroplane heard from the cockpit (the viewpoint fader's interior side): the cabin's insulation stays
  //              the build's (ruling s5) - this is the game's listening level for the cockpit, so the cabin is not 9-12 dB
  //              under the chase view at the same throttle
  //   airframe   the airframe group (the wind, the ground, the events): 0 since G1726 (SND-MIX-2, the user 2026-10-13: "your
  //              engine is quieter than a metal squeal") - was +4; the brakes, the chirp, the rollout tamed at their source
  //              (airframe_worklet.js); the wind 16-20 dB under the engine in the cockpit at cruise, still the clear second
  //   ambience   the beds and the emitters in the world (a loading screen in the world included), and ambienceRun MORE
  //              while an engine of the flown aeroplane runs (a duck, ramped over ~3 s: an aeroplane parked with its engine
  //              off hears its world at the plain trim; one idling on the stand leads its airfield by ~9 dB)
  //   music      the music bus in flight (music in flight on): -10 since G1726 (was -6: 6-8 LU under the engine in the
  //              cockpit at cruise; now >= 10, GATE MIXLEAD), under the engine, not over it; the welcome and the shed keep
  //              their level. Radio Jolene's voice rides the same bus (it stays ~3 dB over its bed, as before)
  const MIX = { engine: 8, interior: 6, airframe: 0, ambience: -6, ambienceRun: -10, music: -10 };
  const dBk = d => Math.pow(10, d / 20);
  const MIXK = { engine: dBk(MIX.engine), interior: dBk(MIX.interior), airframe: dBk(MIX.airframe), ambience: dBk(MIX.ambience),
                 ambienceRun: dBk(MIX.ambienceRun), music: dBk(MIX.music) };
  const RUN_TAU = 1;
  const MIX_TAU = 0.4;   // a trim that follows the shed's door ramps over ~1 s (the cut into the world is never a step)
  // G1724 THE FRAME'S TIME CONSTANT (the laptop: 3-4 fps, dt up to ~0.33 s): the sources' setTargetAtTime tau follows the
  // frame - 0.6 x the smoothed dt, 30 ms .. 250 ms - so a parameter that arrives every 0.3 s glides across the gap instead
  // of a 30 ms step every 0.3 s (the zipper a throttle move would otherwise make); at 60 fps it is the 30 ms it always was
  const TAU_S = new Float64Array(2); TAU_S[0] = 0.03; TAU_S[1] = 1 / 60;
  const now = () => (W.performance && W.performance.now ? W.performance.now() : Date.now());
  const HEADSET_K = Math.pow(10, -15 / 20);   // §4: a passive headset, ~15 dB
  const FADE_S = 0.2, GAIN_TAU = 0.03;
  // THE VIEWPOINT (G1643, SND-SPACE; MSFS's VIEWPOINT state): interior <-> exterior cross-fades over 150 ms at EQUAL
  // POWER (ext cos, int sin of the same ramp: ext^2 + int^2 = 1 all along), from wherever a fade in progress stands.
  // XF: [the target 0|1, the fade's start time, its start share, its duration]; the curves are filled per switch
  const XFADE_S = 0.15, XF = new Float64Array([-1, 0, 0, 0]);
  const XC_E = new Float32Array(32), XC_I = new Float32Array(32);
  const BUSES = ['master', 'aircraft', 'aircraft.ext', 'aircraft.int', 'ambience', 'music', 'ui'];

  const set = {}; for (const r of SETTINGS) set[r[0]] = readSetting(r[0]);
  const srcs = [], handlers = {}, modules = {};
  const N = {};   // the nodes, by bus name (+ fade, limiter)
  let ctx = null, P = null;
  let suspendTimer = 0, silent = false, hidden = false, focused = true, held = false;
  let interior = 0, flying = 0, running = 0;   // (G1720: an engine of the flown aeroplane runs - the ambience's duck)
  // G1672 THE WELCOME: a LOADING SCREEN (BOOT, boot.js) is not the air - nothing flies under it, and the loading music
  // plays there. Every loading screen, not only the first boot's (the user, 2026-10-05: "random songs for the
  // loadings"): the first boot, the roll-out, a change of place - whenever BOOT's overlay is up (loading / landing /
  // waiting; 'ready' and 'gone' are the overlay down).
  let welcome = 1, garage = 0;
  const welcomeNow = () => {
    const B = W.BOOT;
    welcome = B && (B.state === 'loading' || B.state === 'landing' || B.state === 'waiting') ? 1 : 0;
    return welcome;
  };
  // the listener, handed to audioParams; its position in a typed slot (a double written into an object field is a fresh
  // heap box on every write - the frame must not allocate)
  const CAM = { mode: null, inGarage: false, held: false, p: new Float64Array(3) };
  // the bus targets last scheduled (a frame schedules nothing unless one moved)
  const tgt = new Float64Array(BUSES.length).fill(-1), tgtFly = new Float64Array(2);
  // the cost: calls, the smoothed ms a frame, the worst (typed slots, for the same reason)
  const ST = new Float64Array(3);
  const stats = { get calls() { return ST[0]; }, get ms() { return ST[1]; }, get maxMs() { return ST[2]; }, get sources() { return srcs.length; } };

  const api = {
    enabled: true, state: 'armed', ctx: null, params: null, stats, SETTINGS,
    // G1643 (SND-SPACE): the propagation lag the sources add to their schedule times (space.js writes it; s), the space
    // module (space.js sets it: the cabin, the headset, the ambience's duck), and the frame's camera and sim (space.js
    // reads the listener's orientation and the aeroplane's nodes off them - references, nothing allocated)
    lagS: new Float64Array(1), space: null, camera: null, sim: null,
    // G1720-G1724 (SND-MIX): the mix trims (dB, read-only: the offline render and GATE AUDIO read them), the frame's tau
    // (tauS[0], s: the sources' setTargetAtTime constant) and the levels the space applies (engine, airframe: their volume
    // x the trim; [2] the trims' own tau)
    MIX, tauS: TAU_S, levels: new Float64Array([1, 1, GAIN_TAU]),
    refreshGains() { applyGains(); },
    world: null,   // G1651: the world update() was last handed (the ambience reads the cover, the coast, the zones off it)
    rowHooks: [], addRows(fn) { api.rowHooks.push(fn); },   // G1672: fn(body, kit, toggle) adds rows under the settings
    // G1672: the shed as update() last saw it; G1723: the loading screen read NOW (BOOT's state - a press of #bootMusic or a
    // setting between two frames is answered on the screen that is up, not on the last frame's)
    get inGarage() { return garage === 1; }, get welcome() { return welcomeNow() === 1; },
    get pumped() { return LAST[1]; }, pump: () => pump(),   // G1723: the stalled-loop pump (the count; one tick, for the gate)
    bus: name => N[name] || null,
    get: k => set[k],
    set(k, v) {
      if (!(k in set)) return;
      const kind = SETTINGS.find(r => r[0] === k)[2];
      set[k] = kind === 'bool' ? (v ? 1 : 0) : Math.max(0, Math.min(TOP[k], +v || 0));
      prefSet(PREF + '.' + k, set[k]);
      applyGains(); silence(); emit('settings', { k, v: set[k] });
    },
    addSource(name, src) {
      for (let i = srcs.length - 1; i >= 0; i--) if (srcs[i].name === name) { disconnectSrc(srcs[i]); srcs.splice(i, 1); }
      const rec = { name, src, live: false };
      srcs.push(rec);
      if (ctx) connectSrc(rec);
      return rec;
    },
    onEvent(type, fn) { (handlers[type] = handlers[type] || []).push(fn); return () => { const h = handlers[type]; const i = h.indexOf(fn); if (i >= 0) h.splice(i, 1); }; },
    emit: (type, detail) => emit(type, detail),
    module(stem) {
      if (!ctx || !ctx.audioWorklet) return Promise.resolve(false);
      if (!modules[stem]) {
        const map = W.FLYDIY_AUDIO_SRC || {};
        modules[stem] = ctx.audioWorklet.addModule(map[stem] || ('src/viewer/audio/' + stem + '.js')).then(() => true);
      }
      return modules[stem];
    },
    unlock: () => unlock(),
    shutter: () => shutter(),   // G1730: photo mode's shot (true = played)
    enable(on) {
      prefSet(PREF, on ? '1' : '0');
      if (on) { if (api.state === 'off') api.state = 'armed'; unlock(); }   // the click on the switch IS a gesture
      else close();
    },
    stateLine() {
      if (api.state === 'armed') return 'Waiting for the first click or key (the browser asks for one).';
      if (api.state === 'unsupported') return 'This browser has no Web Audio.';
      if (api.state === 'failed') return 'The browser refused the sound context.';
      if (api.state === 'off') return 'Sound is off.';
      return (api.state === 'suspended' ? 'Silent (hidden, paused or unfocused)' : 'Playing') +
        (ctx ? ' · ' + Math.round(ctx.sampleRate / 100) / 10 + ' kHz' : '') + ' · ' + srcs.length + ' source' + (srcs.length === 1 ? '' : 's');
    },
    mount(body, kit) { mountRows(api, body, kit, false); },
    update,
  };

  function emit(type, detail) {
    const h = handlers[type]; if (!h) return;
    for (let i = 0; i < h.length; i++) { try { h[i](detail, api); } catch (e) { console.warn('flyDiy audio: a ' + type + ' handler threw', e); } }
  }
  function connectSrc(rec) {
    rec.live = false;
    try { if (rec.src.connect) rec.src.connect(ctx, api); rec.live = true; }
    catch (e) { console.warn('flyDiy audio: the source ' + rec.name + ' did not connect', e); }
  }
  function disconnectSrc(rec) {
    try { if (rec.live && rec.src.disconnect) rec.src.disconnect(); } catch (e) {}
    rec.live = false;
  }

  // ---- THE GESTURE -------------------------------------------------------------------------------------
  function arm() {
    if (!W.addEventListener) return;
    W.addEventListener('pointerdown', unlock, true);
    W.addEventListener('keydown', unlock, true);
  }
  function disarm() {
    if (!W.removeEventListener) return;
    W.removeEventListener('pointerdown', unlock, true);
    W.removeEventListener('keydown', unlock, true);
  }
  // AUDIO-ROBUST: the output buffer stays 'interactive' (PERF-LEAD 22 Nov: a bigger one adds latency to every engine
  // response); ?audiolat=balanced|playback|<seconds> is the measured A/B (under-runs before/after, AUDIO.record's playout)
  const LAT_HINT = (() => { let v = null; try { v = new URLSearchParams(W.location ? W.location.search : '').get('audiolat'); } catch (e) {}
    if (v === 'balanced' || v === 'playback' || v === 'interactive') return v; const x = +v; return v && x > 0 && x < 1 ? x : 'interactive'; })();
  function unlock() {
    if (ctx || api.state === 'off') { disarm(); return; }
    disarm();
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) { api.state = 'unsupported'; return; }
    try { ctx = new AC({ latencyHint: LAT_HINT }); }
    catch (e) { api.state = 'failed'; console.warn('flyDiy audio: no context', e); return; }
    api.ctx = ctx;
    build();
    if (!P && AP) { P = AP.audioParamsBlock(); api.params = P; }
    api.state = 'running';
    try { const r = ctx.resume && ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    const D = W.document;
    if (D && D.addEventListener) {
      hidden = !!D.hidden;
      D.addEventListener('visibilitychange', onVis);
    }
    if (D && typeof D.hasFocus === 'function') { try { focused = !!D.hasFocus(); } catch (e) {} }
    W.addEventListener('blur', onBlur); W.addEventListener('focus', onFocus);
    for (const rec of srcs) connectSrc(rec);
    applyGains(); silence();
    startPump();
    emit('ready', ctx);
  }
  // G1723 THE PUMP: the sources run off app.js's loop - and the loop does not run before the first light, nor draw (nor
  // call update) while a place change holds the render (holdRender), so a loading screen's music could not start or move
  // on. Once the context exists, a 4 Hz timer looks: no update() for PUMP_STALL_S -> it runs update() itself, with the
  // last frame's sim, camera and aeroplane (the sources keep their last numbers; the music's clocks and the loading
  // screen's context move). A frame from the loop makes it idle again. Never before the gesture; gone with the context.
  // AUDIO-ROBUST (22 Nov 2026, the user: "huge saturation, slow-down and speeds up, pitch variation" in lags and freezes).
  // A MAIN-THREAD BLOCK IS NOT A FRAME. The 4 Hz timer is a task like any other: after a 1 s block it is the FIRST task to
  // run, sees no update for 1 s and used to fire update(dt 0.5) on the last sim - while PACE holds the flight across the
  // same stall (app.js G1365: the next real frame is dt 1/60). The space's clocks then read half a second of an aeroplane
  // standing still (its velocity, the doppler, dragged toward 0) and snapped back over the next frames: a pitch swoop on
  // every voice. Now (ROBUST) a pump tick that itself came LATE (the timer starved: the thread was blocked) is a block's
  // end, not an absence: it does nothing, the loop's own frame comes next. The pump still runs where it is for - a loading
  // screen (BOOT up), a loop gone for good (three on-time ticks with no frame: holdRender) - and every update that follows
  // a gap (STALL_GAP_S) or comes from the pump is a STALL frame (api.stall[0] = 1): the space holds its velocities and
  // its doppler across it (space.js). ?audiorobust=0 = the old behaviour, for the before/after recordings.
  const ROBUST = (() => { try { return new URLSearchParams(W.location ? W.location.search : '').get('audiorobust') !== '0'; } catch (e) { return true; } })();
  const STALL_GAP_S = 0.3, PUMP_LATE_MS = 150, PUMP_GONE_TICKS = 3;
  const PUMP_MS = 250, PUMP_STALL_S = 0.4, LAST = new Float64Array(5);   // [0] the last update's clock (ms), [1] pumped, [2] the last pump tick (ms), [3] on-time ticks with no frame, [4] the last update was the pump's (1)
  let pumpId = 0, lastDef = null, lastCam = null;
  function startPump() {
    if (pumpId || typeof setInterval !== 'function') return;
    LAST[0] = now(); LAST[2] = LAST[0]; LAST[3] = 0; LAST[4] = 1;   // (no loop frame yet: before the first light the pump runs freely)
    pumpId = setInterval(pump, PUMP_MS);
  }
  function stopPump() { if (pumpId && typeof clearInterval === 'function') clearInterval(pumpId); pumpId = 0; }
  function pump() {
    if (!ctx) { stopPump(); return; }
    const tn = now(), el = (tn - LAST[0]) / 1000, late = tn - LAST[2] > PUMP_MS + PUMP_LATE_MS;
    LAST[2] = tn;
    if (el < PUMP_STALL_S || hidden) { LAST[3] = 0; return; }   // (a hidden tab: the sound is silent and suspended anyway)
    if (ROBUST && !welcomeNow() && LAST[4] === 0) {
      // the loop drew last and no loading screen is up: a late tick is a block's end (the loop's frame is next), an on-time
      // one counts toward 'the loop is gone' (holdRender), which only PUMP_GONE_TICKS in a row believe
      if (late) { LAST[3] = 0; STALLS[0]++; return; }
      if (++LAST[3] < PUMP_GONE_TICKS) return;
    }
    LAST[1]++;
    pumping = 1;
    try { update(api.sim, api.camera, Math.min(0.5, el), lastDef, lastCam, garage === 1, api.world); } finally { pumping = 0; }
  }
  // the stall counters (typed): [0] late pump ticks swallowed, [1] stall frames handed to the sources
  const STALLS = new Float64Array(2), STALL = new Float64Array(1);
  let pumping = 0;
  function build() {
    const g = () => ctx.createGain();
    const L = N.limiter = ctx.createDynamicsCompressor();
    L.threshold.value = -1; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.12;
    N.fade = g(); N.fade.gain.value = 1;
    for (const b of BUSES) N[b] = g();
    N.master.connect(N.fade); N.fade.connect(L);
    // AUDIO-ROBUST 2 (22 Nov 2026, the user: "huge saturation"): THE CEILING. The DynamicsCompressor above is not a
    // brick wall: ratio 20 above -1 dBFS lets 1/20 of an overshoot through, its 2 ms attack lets a transient's first
    // milliseconds through, and the browser adds its own makeup gain on top (Chrome: (1 / full-range gain)^0.6 = +0.57 dB
    // here) - a hot burst left the page above 0 dBFS and the output CLIPPED (the harsh, square saturation). The ceiling
    // after it is a WaveShaper on the audio thread: the identity up to -1 dBFS (CEIL_K: everything the measured mix plays,
    // GATE MIXLEAD's peaks, passes unchanged but for the oversampling filter's ripple), above it a tanh knee that reaches full scale only at +6 dBFS in (CEIL_IN):
    // whatever arrives, the speakers get a round, never a clipped, wave. 2x oversampled (the knee's harmonics folded
    // back would be heard). ?audiorobust=0: no ceiling (the before).
    if (ROBUST && ctx.createWaveShaper) {
      const C = N.ceiling = ctx.createWaveShaper(), pre = N.ceilIn = ctx.createGain();
      pre.gain.value = 1 / CEIL_IN;   // the shaper's domain [-1, 1] is the signal's [-CEIL_IN, +CEIL_IN]
      C.curve = ceilingCurve(); C.oversample = '2x';
      L.connect(pre); pre.connect(C); C.connect(ctx.destination);
      N.out = C;   // the last node before the speakers (AUDIO.record taps it)
    } else { L.connect(ctx.destination); N.out = L; }
    N.aircraft.connect(N.master);
    // G1720: the interior side through its own trim (MIX.interior; the viewpoint fader stays a pure equal-power pair)
    N.intTrim = g(); N.intTrim.gain.value = MIXK.interior;
    N['aircraft.ext'].connect(N.aircraft); N['aircraft.int'].connect(N.intTrim); N.intTrim.connect(N.aircraft);
    N.ambience.connect(N.master); N.music.connect(N.master); N.ui.connect(N.master);
    tgt.fill(-1); XF[0] = -1;
  }
  // THE CEILING's curve (above): x in [-1, 1] is the signal u = CEIL_IN x (the gain before it); y = u for |u| <= CEIL_K, else
  // CEIL_K + (1 - CEIL_K) tanh((|u| - CEIL_K) / (1 - CEIL_K)) - continuous in value and slope at the knee, 1.0 at CEIL_IN
  // (tanh of 10: 1 - 4e-9). A WaveShaper interpolates the curve linearly, so the identity part is a straight line.
  const CEIL_K = Math.pow(10, -1 / 20), CEIL_IN = 2, CEIL_N = 8193;
  function ceilingCurve() {
    const c = new Float32Array(CEIL_N);
    for (let i = 0; i < CEIL_N; i++) {
      const u = CEIL_IN * (2 * i / (CEIL_N - 1) - 1), a = u < 0 ? -u : u;
      const y = a <= CEIL_K ? a : CEIL_K + (1 - CEIL_K) * Math.tanh((a - CEIL_K) / (1 - CEIL_K));
      c[i] = u < 0 ? -y : y;
    }
    return c;
  }
  function close() {
    clearSuspend(); stopPump();
    for (const rec of srcs) disconnectSrc(rec);
    const D = W.document;
    if (D && D.removeEventListener) D.removeEventListener('visibilitychange', onVis);
    if (W.removeEventListener) { W.removeEventListener('blur', onBlur); W.removeEventListener('focus', onFocus); }
    disarm();
    if (ctx) { try { const r = ctx.close(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    ctx = null; api.ctx = null; silent = false;
    for (const k of Object.keys(N)) delete N[k];
    for (const k of Object.keys(modules)) delete modules[k];
    api.state = 'off';
  }

  // ---- THE GAINS: scheduled only when a target moves -----------------------------------------------------
  function ramp(i, node, v, tau) {
    if (tgt[i] === v) return;
    tgt[i] = v;
    const p = node.gain;
    if (p.setTargetAtTime) p.setTargetAtTime(v, ctx.currentTime, tau); else p.value = v;
  }
  // the viewpoint's equal-power cross-fade (above): toward `to` (1 interior) from the share the last fade has reached
  function xfade(to) {
    if (XF[0] === to) return;
    const pe = N['aircraft.ext'].gain, pi = N['aircraft.int'].gain, t = ctx.currentTime;
    let x = to;
    if (XF[0] >= 0) { const u = XF[3] > 0 ? Math.min(1, Math.max(0, (t - XF[1]) / XF[3])) : 1; x = XF[2] + (XF[0] - XF[2]) * u; }
    XF[0] = to; XF[1] = t; XF[2] = x; XF[3] = XFADE_S * Math.abs(to - x);
    if (pe.cancelScheduledValues) { pe.cancelScheduledValues(t); pi.cancelScheduledValues(t); }
    if (XF[3] < 1e-3 || !pe.setValueCurveAtTime) {   // the first frame (nothing to fade from), or no curves: set
      if (pe.setValueAtTime) { pe.setValueAtTime(to ? 0 : 1, t); pi.setValueAtTime(to ? 1 : 0, t); } else { pe.value = to ? 0 : 1; pi.value = to ? 1 : 0; }
      return;
    }
    const n = XC_E.length;
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 * (x + (to - x) * i / (n - 1)); XC_E[i] = Math.cos(a); XC_I[i] = Math.sin(a); }
    XC_E[n - 1] = to ? 0 : 1; XC_I[n - 1] = to ? 1 : 0;   // the endpoints exact (cos pi/2 is 6e-17, not 0)
    pe.setValueCurveAtTime(XC_E, t, XF[3]); pi.setValueCurveAtTime(XC_I, t, XF[3]);
  }
  function applyGains() {
    if (!ctx) return;
    // the headset: the space module's curve on the cabin's own chain when it is there (space.js: a passive or an ANR
    // headset's filters), else the flat -15 dB on the aircraft in the cockpit (the fallback)
    const sp = api.space;
    const hs = interior && set.headset && !sp ? HEADSET_K : 1;
    // G1722: with the space the volumes are its groups' (engine: every engine group, airframe: the airframe group and its
    // interior-only layers) and the aircraft bus is unity; without it (no space.js) 'aircraft' stays the group's master
    const world = garage ? 0 : 1, lv = api.levels;
    lv[0] = world ? set.engine * MIXK.engine : Math.min(1, set.engine);   // G1728: the shed never above 100 %
    lv[1] = set.aircraft * (world ? MIXK.airframe : 1); lv[2] = MIX_TAU;
    ramp(0, N.master, set.master, GAIN_TAU);
    ramp(1, N.aircraft, (sp ? 1 : set.aircraft) * hs, GAIN_TAU);
    xfade(interior);
    if (sp && sp.applyLevels) sp.applyLevels(lv);
    // the ambience inside the cabin: ducked by the build's insulation and the headset (space.js), else the flat headset;
    // out of the shed MIX.ambience under it (a loading screen in the world included: the world's beds, the same level)
    const kRun = world && running ? MIXK.ambienceRun : 1;
    ramp(4, N.ambience, set.environment * (sp && sp.ambienceK ? sp.ambienceK(interior) : hs) * (world ? MIXK.ambience : 1) * kRun,
         running !== tgtFly[1] ? RUN_TAU : world !== tgtFly[0] ? MIX_TAU : GAIN_TAU);
    tgtFly[1] = running;
    ramp(5, N.music, set.music * (flying ? (set.musicFlight ? MIXK.music : 0) : 1), GAIN_TAU);
    tgtFly[0] = world;
    ramp(6, N.ui, set.interface, GAIN_TAU);
  }

  // ---- THE SILENCE: hidden / paused / unfocused -> 0.2 s to nothing, then suspend; back on return --------
  function clearSuspend() { if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = 0; } }
  function doSuspend() {
    suspendTimer = 0;
    if (!ctx || !silent) return;
    try { const r = ctx.suspend(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    api.state = 'suspended'; emit('suspend');
  }
  function silence() {
    if (!ctx) return;
    const want = hidden || held || (!!set.muteUnfocused && !focused);
    if (want === silent) return;
    silent = want;
    const p = N.fade.gain, t = ctx.currentTime;
    clearSuspend();
    if (p.cancelScheduledValues) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
    if (want) {
      if (p.linearRampToValueAtTime) p.linearRampToValueAtTime(0, t + FADE_S); else p.value = 0;
      suspendTimer = setTimeout(doSuspend, FADE_S * 1000 + 20);
    } else {
      try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
      if (p.linearRampToValueAtTime) p.linearRampToValueAtTime(1, t + FADE_S); else p.value = 1;
      if (api.state === 'suspended') { api.state = 'running'; emit('resume'); }
    }
  }
  function onVis() { hidden = !!(W.document && W.document.hidden); silence(); }
  function onBlur() { focused = false; silence(); }
  function onFocus() { focused = true; silence(); }

  // ---- G1730 THE SHUTTER (A0 for the user, 27 Oct: photo mode's shutter, GAME-MENUS G3741/G3742) ------------
  // A synthesized SLR shot, no file: the mirror's click (a 3.5 kHz noise tick over a 140 -> 70 Hz thump), the curtain's
  // swish (noise through a band sweeping 2 -> 6 kHz) and the second curtain's click at +90 ms; ~0.2 s in all, at the
  // 'interface' volume. Photo mode PAUSES the flight (FLYDIY_HELD: the mix faded to nothing and the context suspended),
  // so the shot goes round the fade - its own gain straight into the limiter, never through master/fade, so it neither
  // ducks the engine nor brings the paused mix back - and wakes the context for itself, put back to sleep after it
  // when the silence still holds. Nodes per shot (a discrete event, not the frame); the noise buffer once.
  const SHUT = { out: 0.32, len: 0.3 };
  let noiseBuf = null, shutWake = 0;
  function shutter() {
    if (!ctx || !N.limiter || !ctx.createBiquadFilter || !ctx.createOscillator || !ctx.createBuffer) return false;
    const v = set.master * set.interface * SHUT.out;
    if (!(v > 0)) return false;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * SHUT.len), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (silent) {   // the pause / a hidden tab: wake for the shot (the fade stays at 0: the rest stays silent)
      clearSuspend(); if (shutWake) clearTimeout(shutWake);
      try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
      // back to sleep: the bare suspend when the silence had already suspended (no event: the music stays paused), else
      // the silence's own (the shot came inside its 0.2 s fade and cleared its timer: the 'suspend' still has to come)
      shutWake = setTimeout(() => { shutWake = 0; if (!silent || !ctx) return;
        if (api.state !== 'suspended') doSuspend(); else try { const r = ctx.suspend(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }, 400);
    }
    const t0 = ctx.currentTime + 0.005, out = ctx.createGain();
    out.gain.value = v; out.connect(N.limiter);
    const tick = (t, f, q, a, d) => {   // a noise tick: attack 1 ms, exponential decay d s
      const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.001); g.gain.setTargetAtTime(0, t + 0.001, d / 4);
      s.connect(b); b.connect(g); g.connect(out); s.start(t, Math.random() * 0.1, d + 0.02); return s;
    };
    const thump = (t, f0, f1, a, d) => {   // the body's knock: a falling sine
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, d / 4);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02); return o;
    };
    tick(t0, 3500, 1.2, 1, 0.015); thump(t0, 140, 70, 0.6, 0.05);
    const sw = ctx.createBufferSource(), sb = ctx.createBiquadFilter(), sg = ctx.createGain();   // the curtain's swish
    sw.buffer = noiseBuf; sb.type = 'bandpass'; sb.Q.value = 0.9;
    sb.frequency.setValueAtTime(2000, t0 + 0.012); sb.frequency.exponentialRampToValueAtTime(6000, t0 + 0.08);
    sg.gain.setValueAtTime(0, t0 + 0.012); sg.gain.linearRampToValueAtTime(0.22, t0 + 0.04); sg.gain.linearRampToValueAtTime(0, t0 + 0.085);
    sw.connect(sb); sb.connect(sg); sg.connect(out); sw.start(t0 + 0.012, 0, 0.08);
    tick(t0 + 0.09, 2500, 1, 0.8, 0.012);
    const last = thump(t0 + 0.09, 110, 60, 0.4, 0.04);
    last.onended = () => { try { out.disconnect(); } catch (e) {} };
    return true;
  }

  // ---- THE FRAME ------------------------------------------------------------------------------------------
  // sim: the page's sim (the worker's snapshot mirrored, or the inline solver); camera: the THREE camera (the
  // listener's position); dt: the frame's seconds; def: the flown aeroplane (def.spec, def.params, def.refs);
  // cam: app.js's camera prefs ({ mode }); inGarage; world (world.surface for the ground under the wheels).
  function update(sim, camera, dt, def, cam, inGarage, world) {
    if (!ctx) return;
    const t0 = now();
    // AUDIO-ROBUST: a frame after a gap (a block, a lag past STALL_GAP_S) or from the pump is a STALL frame (above)
    STALL[0] = ROBUST && (pumping || t0 - LAST[0] > STALL_GAP_S * 1000) ? 1 : 0;
    if (STALL[0]) STALLS[1]++;
    LAST[4] = pumping;
    if (!pumping) LAST[3] = 0;
    TR.gap[0] = t0 - LAST[0];
    LAST[0] = t0; lastDef = def || null; lastCam = cam || null;
    CAM.mode = cam ? cam.mode : null;
    CAM.inGarage = !!inGarage;
    CAM.held = !!W.FLYDIY_HELD;
    const cp = camera && camera.position;
    if (cp) { CAM.p[0] = cp.x; CAM.p[1] = cp.y; CAM.p[2] = cp.z; }
    if (P && sim && def) AP.audioParams(sim, CAM, def, P, world, dt);
    const gw = garage; garage = inGarage ? 1 : 0;
    api.world = world || null;
    // G1724: the frame's tau (0.6 x the smoothed dt, 30..250 ms; a hitch longer than 1 s is not a frame rate)
    const d = dt > 0 && dt < 1 ? dt : TAU_S[1];
    TAU_S[1] += (d - TAU_S[1]) * 0.25; TAU_S[0] = Math.min(0.25, Math.max(GAIN_TAU, 0.6 * TAU_S[1]));
    const wl = welcomeNow(), inn = !inGarage && CAM.mode === 'cockpit' ? 1 : 0, fl = inGarage || wl ? 0 : 1;
    let run = 0;
    if (P && sim && def) for (let i = 0, ne = P.s[P.I.nEng] | 0; i < ne && i < 4; i++) if (P.running[i] > 0) run = 1;
    if (inn !== interior || fl !== flying || garage !== gw || run !== running) {
      const was = interior; interior = inn; flying = fl; running = run; applyGains();
      if (was !== inn) emit('perspective', inn);
    }
    if (CAM.held !== held) { held = CAM.held; silence(); }
    api.camera = camera || null; api.sim = sim || null;   // G1643: the space module's listener and emitters (references)
    if (P) for (let i = 0; i < srcs.length; i++) {
      const r = srcs[i];
      if (!r.live || !r.src.update) continue;
      try { r.src.update(P, dt, api); }
      catch (e) { r.live = false; console.warn('flyDiy audio: the source ' + r.name + ' threw and is off', e); }
    }
    const ms = now() - t0;
    ST[0]++; ST[1] += (ms - ST[1]) * 0.02; if (ms > ST[2]) ST[2] = ms;
    if (TR.on) trace(t0, dt);
  }

  // ---- AUDIO-ROBUST: THE PROOF TOOLS (22 Nov 2026) - nothing runs, nothing is built until a rig or a dev calls them ------
  // AUDIO.record.start({ mono, decim }) / AUDIO.record.stop() -> { sr, ch, frames, peak, clipped, pcm (Int16Array) }: the
  //   page's OWN output (the last node before the speakers), tapped by a tiny AudioWorklet on the audio thread (a Blob
  //   module, made on the first call), so a main-thread block is recorded as it is heard. ~2 KB of code, no load cost.
  // AUDIO.stallTest({ seconds, blocks: [[atS, ms], ...], lag: [atS, durS, frameMs] }) -> the recording + the frame trace
  //   (every update: wall ms, gap, dt, pumped, stall, the engine's rpm, the space's doppler and lag, the frame tau) - the
  //   scripted 300 ms and 1 s main-thread blocks the user listens to, before (?audiorobust=0) and after.
  const TR = { on: 0, rows: null, n: 0, gap: new Float64Array(1) };
  const TR_W = 10, TR_MAX = 6000;
  function trace(t0, dt) {
    if (TR.n >= TR_MAX) return;
    const r = TR.rows, o = TR.n++ * TR_W, sp = api.space, fr = sp && sp.frame;
    r[o] = t0; r[o + 1] = ctx.currentTime; r[o + 2] = TR.gap[0]; r[o + 3] = dt; r[o + 4] = pumping; r[o + 5] = STALL[0];
    r[o + 6] = P && P.rpmEng ? +P.rpmEng[0] || 0 : 0; r[o + 7] = fr ? fr[8] : 1; r[o + 8] = api.lagS[0]; r[o + 9] = TAU_S[0];
  }
  const TAP_SRC = "registerProcessor('flydiy-tap', class extends AudioWorkletProcessor {" +
    "constructor(o) { super(); const p = o.processorOptions || {}; this.mono = !!p.mono; this.dec = p.decim > 1 ? p.decim | 0 : 1;" +
    " this.ch = this.mono ? 1 : 2; this.buf = new Float32Array(this.ch * 8192); this.n = 0; this.on = true; this.ph = 0; this.blocks = 0;" +
    " this.port.onmessage = e => { if (e.data === 'stop') { this.flush(); this.port.postMessage({ end: 1, blocks: this.blocks }); this.on = false; } }; }" +
    "flush() { if (this.n) { this.port.postMessage(this.buf.slice(0, this.n * this.ch)); this.n = 0; } }" +
    "process(inp) { if (!this.on) return false; this.blocks++; const a = inp[0] || [], L = a[0], R = a[1] || L, ch = this.ch;" +
    " for (let k = 0; k < 128; k++) { if (++this.ph < this.dec) continue; this.ph = 0;" +
    "  const l = L ? L[k] : 0, r = R ? R[k] : 0, o = this.n * ch;" +
    "  if (ch === 1) this.buf[o] = 0.5 * (l + r); else { this.buf[o] = l; this.buf[o + 1] = r; }" +
    "  if (++this.n * ch >= this.buf.length) this.flush(); }" +
    " return true; } });";
  let tapMod = null;
  const REC = { node: null, chunks: null, done: null, opt: null };
  function recStart(o) {
    o = o || {};
    if (!ctx || !N.out || !ctx.audioWorklet || REC.node) return Promise.resolve(false);
    if (!tapMod) {
      const url = URL.createObjectURL(new Blob([TAP_SRC], { type: 'application/javascript' }));
      tapMod = ctx.audioWorklet.addModule(url);
    }
    return tapMod.then(() => {
      const node = new AudioWorkletNode(ctx, 'flydiy-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 2, channelCountMode: 'explicit', processorOptions: { mono: !!o.mono, decim: o.decim || 1 } });
      REC.node = node; REC.chunks = []; REC.opt = { mono: !!o.mono, decim: o.decim > 1 ? o.decim | 0 : 1, t0: ctx.currentTime, wall: now() };
      REC.done = new Promise(res => { node.port.onmessage = e => { if (e.data && e.data.end) res(e.data.blocks); else REC.chunks.push(e.data); }; });
      N.out.connect(node); node.connect(ctx.destination);   // (its output is silence: connected so the graph pulls it)
      return true;
    });
  }
  function recStop() {
    if (!REC.node) return Promise.resolve(null);
    const node = REC.node, opt = REC.opt;
    node.port.postMessage('stop');
    return REC.done.then(blocks => {
      try { N.out.disconnect(node); } catch (e) {} try { node.disconnect(); } catch (e) {}
      const ch = opt.mono ? 1 : 2; let len = 0; for (const c of REC.chunks) len += c.length;
      const pcm = new Int16Array(len); let peak = 0, clipped = 0, i = 0;
      for (const c of REC.chunks) for (let k = 0; k < c.length; k++) {
        const v = c[k], a = v < 0 ? -v : v; if (a > peak) peak = a; if (a >= 0.999) clipped++;
        pcm[i++] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      }
      REC.node = null; REC.chunks = null;
      const ps = ctx.playbackStats || ctx.playoutStats || null;   // Chrome's under-run counters, when this browser has them
      let play = null;
      try { if (ps) play = { fallbackFramesEvents: ps.fallbackFramesEvents, fallbackDuration: ps.fallbackDuration, underrunEvents: ps.underrunEvents, underrunDuration: ps.underrunDuration, totalFramesDuration: ps.totalFramesDuration, averageLatency: ps.averageLatency }; } catch (e) {}
      return { sr: ctx.sampleRate / opt.decim, ch, frames: len / ch, peak, clipped, blocks, wallS: (now() - opt.wall) / 1000, ctxT0: opt.t0,
               ctxS: ctx.currentTime - opt.t0, baseLatency: ctx.baseLatency, outputLatency: ctx.outputLatency, playout: play,
               robust: ROBUST, latencyHint: LAT_HINT, pcm };
    });
  }
  const busy = ms => { const e = now() + ms; while (now() < e) { /* the scripted block: the main thread held */ } };
  function stallTest(o) {
    o = o || {};
    const secs = o.seconds || 12, blocks = o.blocks || [[3, 300], [7, 1000]], lag = o.lag || null;
    return recStart(o).then(ok => {
      if (!ok) return null;
      TR.rows = new Float64Array(TR_MAX * TR_W); TR.n = 0; TR.on = 1;
      const s0 = STALLS[0], s1 = STALLS[1];
      const marks = [];
      for (const [at, ms] of blocks) setTimeout(() => { marks.push({ kind: 'block', ms, ctxT: ctx.currentTime, wall: now() }); busy(ms); }, at * 1000);
      if (lag && typeof requestAnimationFrame === 'function') {
        const tA = now() + lag[0] * 1000, tB = tA + lag[1] * 1000;
        const f = () => { const t = now(); if (t > tB) return; if (t >= tA) busy(lag[2]); requestAnimationFrame(f); };
        requestAnimationFrame(f);
        marks.push({ kind: 'lag', at: lag[0], dur: lag[1], frameMs: lag[2] });
      }
      return new Promise(res => setTimeout(res, secs * 1000)).then(recStop).then(r => {
        TR.on = 0;
        r.trace = Array.from(TR.rows.subarray(0, TR.n * TR_W)); r.traceW = TR_W;
        r.traceCols = ['wallMs', 'ctxT', 'gapMs', 'dt', 'pumped', 'stall', 'rpmEng0', 'kDop0', 'lagS', 'tauS'];
        r.marks = marks; r.lateTicks = STALLS[0] - s0; r.stallFrames = STALLS[1] - s1;
        return r;
      });
    });
  }
  api.record = { start: recStart, stop: recStop };
  api.stallTest = stallTest;
  api.stall = STALL; api.stalls = STALLS; api.robust = ROBUST;

  arm();
  // G1730: the shot on photo mode's own event (GAME-MENUS G3744 fires 'flydiy:shutter' at the take: the round shutter and
  // FLYDIY_PHOTO.take) - neither file edits the other's
  if (W.addEventListener) W.addEventListener('flydiy:shutter', () => { shutter(); });
  return api;
})();
if (typeof window !== 'undefined') window.AUDIO = AUDIO;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO;
