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
//   SETTINGS  five volumes (master, aircraft, environment, music, interface),
//             mute when unfocused (on), headset (off), music in flight (off);
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
// ============================================================
var AUDIO = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const PREF = 'flydiy.audio';
  const pref = (k, d) => { try { const v = W.localStorage && W.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const prefSet = (k, v) => { try { if (W.localStorage) W.localStorage.setItem(k, String(v)); } catch (e) {} };
  const query = (() => { try { return new URLSearchParams(W.location ? W.location.search : '').get('audio'); } catch (e) { return null; } })();
  const OFF = query === '0' || (query !== '1' && pref(PREF, '1') === '0');

  // THE SETTINGS: [key, default, kind, label, line]
  const SETTINGS = [
    ['master', 0.8, 'vol', 'master', 'everything'],
    ['aircraft', 1.0, 'vol', 'aircraft', 'the engine, the propeller, the airframe'],
    ['environment', 0.8, 'vol', 'environment', 'the wind, the birds, the sea, the shed'],
    ['music', 0.6, 'vol', 'music', ''],
    ['interface', 0.7, 'vol', 'interface', 'the clicks'],
    ['muteUnfocused', 1, 'bool', 'mute when unfocused', 'silent while another window has the focus'],
    ['headset', 0, 'bool', 'headset', 'in the cockpit, the way a pilot hears it: ~15 dB quieter'],
    ['musicFlight', 0, 'bool', 'music in flight', 'the music plays in the shed; in the air only with this on'],
    ['musicGarage', 1, 'bool', 'music in the garage', 'the shed\'s playlist, with silences between the tracks'],   // G1672 (music.js)
    // G1643 (SND-SPACE, space.js): the headset's kind, and the outside sounds placed for headphones
    ['headsetAnr', 0, 'bool', 'headset: noise cancelling', 'with the headset on: the active kind - the engine\'s drone goes first'],
    ['hrtf', 0, 'bool', '3D on headphones', 'the outside sounds placed for headphones (HRTF): heavier on the processor'],
  ];
  const DEF = {}; for (const r of SETTINGS) DEF[r[0]] = r[1];
  const readSetting = k => {
    const v = +pref(PREF + '.' + k, DEF[k]);
    return v === v ? (SETTINGS.find(r => r[0] === k)[2] === 'bool' ? (v ? 1 : 0) : Math.max(0, Math.min(1, v))) : DEF[k];
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
      if (kind === 'vol') kit.range(body, label, 0, 100, 1, () => Math.round(api.get(k) * 100), v => api.set(k, v / 100), v => v + ' %');
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
      stateLine: () => 'off', unlock() {}, addRows() {}, inGarage: false, welcome: false,
      enable(on) { if (on && query !== '0') prefSet(PREF, '1'); },
      mount(body, kit) { mountRows(stub, body, kit, true); } };
    return stub;
  }

  const AP = W.AUDIO_PARAMS || (typeof AUDIO_PARAMS !== 'undefined' ? AUDIO_PARAMS : null);
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
  let interior = 0, flying = 0;
  // G1672 THE WELCOME: the first boot's loading screen (BOOT, boot.js) is not the air - nothing flies under it, and
  // the welcome music plays there. Latched off for good once that overlay is gone (a later roll-out screen is not it).
  let welcome = 1, garage = 0;
  const welcomeNow = () => {
    if (!welcome) return 0;
    const B = W.BOOT;
    if (!B || B.state === 'gone') welcome = 0;
    return welcome;
  };
  // the listener, handed to audioParams; its position in a typed slot (a double written into an object field is a fresh
  // heap box on every write - the frame must not allocate)
  const CAM = { mode: null, inGarage: false, held: false, p: new Float64Array(3) };
  // the bus targets last scheduled (a frame schedules nothing unless one moved)
  const tgt = new Float64Array(BUSES.length).fill(-1);
  // the cost: calls, the smoothed ms a frame, the worst (typed slots, for the same reason)
  const ST = new Float64Array(3);
  const stats = { get calls() { return ST[0]; }, get ms() { return ST[1]; }, get maxMs() { return ST[2]; }, get sources() { return srcs.length; } };

  const api = {
    enabled: true, state: 'armed', ctx: null, params: null, stats, SETTINGS,
    // G1643 (SND-SPACE): the propagation lag the sources add to their schedule times (space.js writes it; s), the space
    // module (space.js sets it: the cabin, the headset, the ambience's duck), and the frame's camera and sim (space.js
    // reads the listener's orientation and the aeroplane's nodes off them - references, nothing allocated)
    lagS: new Float64Array(1), space: null, camera: null, sim: null,
    refreshGains() { applyGains(); },
    rowHooks: [], addRows(fn) { api.rowHooks.push(fn); },   // G1672: fn(body, kit, toggle) adds rows under the settings
    get inGarage() { return garage === 1; }, get welcome() { return welcome === 1; },   // G1672: what update() last saw
    bus: name => N[name] || null,
    get: k => set[k],
    set(k, v) {
      if (!(k in set)) return;
      const kind = SETTINGS.find(r => r[0] === k)[2];
      set[k] = kind === 'bool' ? (v ? 1 : 0) : Math.max(0, Math.min(1, +v || 0));
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
  function unlock() {
    if (ctx || api.state === 'off') { disarm(); return; }
    disarm();
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) { api.state = 'unsupported'; return; }
    try { ctx = new AC({ latencyHint: 'interactive' }); }
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
    emit('ready', ctx);
  }
  function build() {
    const g = () => ctx.createGain();
    const L = N.limiter = ctx.createDynamicsCompressor();
    L.threshold.value = -1; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.12;
    N.fade = g(); N.fade.gain.value = 1;
    for (const b of BUSES) N[b] = g();
    N.master.connect(N.fade); N.fade.connect(L); L.connect(ctx.destination);
    N.aircraft.connect(N.master);
    N['aircraft.ext'].connect(N.aircraft); N['aircraft.int'].connect(N.aircraft);
    N.ambience.connect(N.master); N.music.connect(N.master); N.ui.connect(N.master);
    tgt.fill(-1); XF[0] = -1;
  }
  function close() {
    clearSuspend();
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
    ramp(0, N.master, set.master, GAIN_TAU);
    ramp(1, N.aircraft, set.aircraft * hs, GAIN_TAU);
    xfade(interior);
    // the ambience inside the cabin: ducked by the build's insulation and the headset (space.js), else the flat headset
    ramp(4, N.ambience, set.environment * (sp && sp.ambienceK ? sp.ambienceK(interior) : hs), GAIN_TAU);
    ramp(5, N.music, set.music * (flying && !set.musicFlight ? 0 : 1), GAIN_TAU);
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

  // ---- THE FRAME ------------------------------------------------------------------------------------------
  // sim: the page's sim (the worker's snapshot mirrored, or the inline solver); camera: the THREE camera (the
  // listener's position); dt: the frame's seconds; def: the flown aeroplane (def.spec, def.params, def.refs);
  // cam: app.js's camera prefs ({ mode }); inGarage; world (world.surface for the ground under the wheels).
  function update(sim, camera, dt, def, cam, inGarage, world) {
    if (!ctx) return;
    const t0 = now();
    CAM.mode = cam ? cam.mode : null;
    CAM.inGarage = !!inGarage;
    CAM.held = !!W.FLYDIY_HELD;
    const cp = camera && camera.position;
    if (cp) { CAM.p[0] = cp.x; CAM.p[1] = cp.y; CAM.p[2] = cp.z; }
    if (P && sim && def) AP.audioParams(sim, CAM, def, P, world, dt);
    garage = inGarage ? 1 : 0;
    const wl = welcomeNow(), inn = !inGarage && CAM.mode === 'cockpit' ? 1 : 0, fl = inGarage || wl ? 0 : 1;
    if (inn !== interior || fl !== flying) {
      const was = interior; interior = inn; flying = fl; applyGains();
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
  }

  arm();
  return api;
})();
if (typeof window !== 'undefined') window.AUDIO = AUDIO;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO;
