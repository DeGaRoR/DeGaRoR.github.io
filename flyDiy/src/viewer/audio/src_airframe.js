// THE AIRFRAME SOURCE (G1633, SND-AIRFRAME; SOUND-2026-10-04 §3.5 / §4).
//
// Wires the airframe voice (airframe_worklet.js, 'flydiy-airframe': wind, ground, water, stall warning, creaks,
// the flap motor and the event one-shots) into SND-CORE's window.AUDIO: ONE AudioWorkletNode for the flown
// aeroplane, fed every frame from the parameter block P through airframe_model.js (the targets + the events).
//   output 0  EXTERIOR mono -> aircraft.ext
//   output 1  INTERIOR mono -> aircraft.int (the cabin's own mix, a placeholder cabin low-pass inside the worklet:
//             SND-SPACE replaces it with the build's cabin transfer; the stall warning, creaks, flap motor and
//             lever are interior-only by construction)
// SND-SPACE (G1644), when space.js is there: THREE outputs - 0 -> AUDIO.space.input('airframe') (spatialised outside,
//   through the build's cabin inside), 1 (stereo: the structure-borne part, the cabin's own wind, the events panned by
//   their wheel) and 2 (the interior-only layers) -> AUDIO.space.interior() (no cabin between); the recorded loops
//   follow (outside ones into the group, inside ones to the interior), a touchdown's recording leans to its wheel's
//   side; every schedule + AUDIO.lagS[0], each event message carries it as `d`; 'space-cut' drops what was scheduled
//   ahead; AUDIO.voices.airframe published for the doppler.
// THE SAMPLES (samples.js): when a declared key resolves, its recording BLENDS IN - a ground / water / stall / flap
// loop follows its layer's level (the worklet's `duck` bit lowers the procedural one to 30 %), an event plays its
// one-shot beside the procedural (the worklet's at 35 %). A key is asked for the first time its layer is heard.
// Per frame: the model (allocation-free), then ONLY the params that moved (the targets are quantised, so a steady
// frame schedules nothing), then the frame's events (a port message each - an event, never a frame).
// AUDIO.emit('stall') at the warning's onset and every 2 s while it sounds (the music ducks under it, G1672).
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const AF = W.AIRFRAME_MODEL;
  if (!AF) return;
  const TAU = 0.03, NP = AF.AF_PARAMS.length, T = AF.T, Q = AF.AF_Q;
  const st = AF.airframeState();
  const last = new Float64Array(NP).fill(-1);
  const discrete = new Uint8Array(NP);
  AF.AF_PARAMS.forEach((k, i) => { discrete[i] = Q[k] === 0 ? 1 : 0; });
  let ctx = null, node = null, params = null, ready = false, ext = null, int = null, SM = null, SPC = 0;
  let EV_WHEEL = null;   // SND-SPACE: a touchdown's / chirp's recorded one-shot routes by wheel (0 left, 1 right)
  const pub = (W.AUDIO.voices = W.AUDIO.voices || {});
  // THE SAMPLES: the surface row -> its loop key; the loops in play (one per key, made when the key resolves)
  const SURF_KEY = ['gnd.grass', 'gnd.dirt', 'gnd.gravel', 'gnd.dirt', null, 'gnd.asphalt', 'gnd.gravel', 'gnd.dirt'];
  // [key, the param that sets its level, the duck bit, the level -> loop gain, interior share]
  const LOOPS = [
    ['gnd.grass', T.gndL, 1, 6, 0.4], ['gnd.gravel', T.gndL, 1, 6, 0.4], ['gnd.asphalt', T.gndL, 1, 6, 0.4], ['gnd.dirt', T.gndL, 1, 6, 0.4],
    ['gnd.rattle', T.tailR, 0, 0.1, 0.6], ['gnd.brake', T.brk, 0, 0.05, 0.4],
    ['water.spray', T.watL, 2, 4, 0.4], ['mech.flap', T.flapM, 0, 0.05, 1], ['stall.reed', T.stall, 16, 0.12, 1], ['stall.buzzer', T.stall, 16, 0.07, 1],
  ];
  const loopP = new Array(LOOPS.length).fill(null);   // the players
  const loopG = new Float64Array(LOOPS.length).fill(-1), asked = new Uint8Array(LOOPS.length);
  // the events' one-shot keys and routes ([node, gain] pairs, made at connect)
  const EV_KEY = [null, 'gnd.thump', 'gnd.squeal', 'gnd.thump', 'water.splash', 'mech.lever'];
  let EV_OUT = null;
  const evAsked = new Uint8Array(EV_KEY.length);
  // the warning's own event for the rest of the sound (SND-MUSIC ducks under it): AUDIO.emit('stall') at the onset and
  // every STALL_EMIT_S while it sounds (the music's duck holds 6 s); [0] the seconds since the last, [1] sounding
  const STALL_EMIT_S = 2, stallClk = new Float64Array(2);

  function loopWanted(i, tg) {
    const L = LOOPS[i], key = L[0];
    if (L[1] === T.gndL) return SURF_KEY[tg[T.gndS] | 0] === key;
    if (key === 'stall.reed') return tg[T.stallK] === AF.AF_STALL.reed;
    if (key === 'stall.buzzer') return tg[T.stallK] === AF.AF_STALL.buzzer;
    return true;
  }
  function samples(tg, t) {
    let duck = 0;
    for (let i = 0; i < LOOPS.length; i++) {
      const L = LOOPS[i], want = loopWanted(i, tg), lvl = want ? tg[L[1]] : 0;
      if (want && lvl > 0 && !asked[i]) {   // the first time this layer is heard: ask for its recording
        asked[i] = 1;
        if (SM.has(L[0])) SM.load(L[0]).then(b => {
          if (!b || !ctx || loopP[i]) return;
          // SND-SPACE: an outside loop enters the airframe group (spatialised, and through the cabin), an inside one the
          // interior; without space.js, outside + a fixed share inside, as before
          const p = SM.loop(L[0], SPC ? (L[4] < 1 ? ext : int) : ext);
          if (p) { if (!SPC) p.out.connect(L[4] < 1 ? intShare(L[4]) : int); loopP[i] = p; }
        });
      }
      const p = loopP[i];
      if (!p) continue;
      if (want) duck |= L[2];
      const g = Math.round(lvl * L[3] * 500) / 500;
      if (g !== loopG[i]) { p.gain.setTargetAtTime(g, t, TAU); loopG[i] = g; }
    }
    return duck;
  }
  const shares = {};
  function intShare(k) {   // a fixed gain into the interior bus per share (made once)
    if (!shares[k]) { shares[k] = ctx.createGain(); shares[k].gain.value = k; shares[k].connect(int); }
    return shares[k];
  }

  function teardown() {
    for (let i = 0; i < loopP.length; i++) { if (loopP[i]) loopP[i].stop(); loopP[i] = null; }
    loopG.fill(-1); asked.fill(0); evAsked.fill(0);
    for (const k in shares) { try { shares[k].disconnect(); } catch (e) {} delete shares[k]; }
    if (node) { try { node.disconnect(); } catch (e) {} }
    node = null; params = null; last.fill(-1); pub.airframe = null;
  }

  W.AUDIO.addSource('airframe', {
    connect(c, api) {
      ctx = c; ready = false;
      ext = api.bus('aircraft.ext'); int = api.bus('aircraft.int');
      // SND-SPACE: the airframe group's input and the interior's own mix replace the two buses
      const sIn = api.space && api.space.input('airframe', 0), sInt = api.space && api.space.interior();
      SPC = sIn && sInt ? 1 : 0;
      if (SPC) { ext = sIn; int = sInt; }
      SM = W.AUDIO_SAMPLES ? W.AUDIO_SAMPLES.attach(c) : null;
      EV_OUT = [null,
        [[ext, 1], [int, 0.6]],        // touchdown: outside, and through the structure
        [[ext, 1], [int, 0.3]],        // the chirp
        [[ext, 0.5], [int, 1]],        // the suspension thump: mostly inside
        [[ext, 1], [int, 0.5]],        // the splash
        [[int, 1]]];                   // the lever: inside only
      EV_WHEEL = null;
      if (SPC && c.createStereoPanner) {   // the recorded touchdown leans to its wheel's side in the cabin
        const pL = c.createStereoPanner(), pR = c.createStereoPanner();
        pL.pan.value = -0.6; pR.pan.value = 0.6; pL.connect(int); pR.connect(int);
        EV_WHEEL = [[[ext, 1], [pL, 0.6]], [[ext, 1], [pR, 0.6]]];
      }
      api.module('airframe_worklet').then(ok => {
        if (!ok || ctx !== c) return;
        node = new AudioWorkletNode(c, 'flydiy-airframe', SPC
          ? { numberOfInputs: 0, numberOfOutputs: 3, outputChannelCount: [1, 2, 1], processorOptions: { seed: 7 } }
          : { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 1], processorOptions: { seed: 7 } });
        node.connect(ext, 0); node.connect(int, 1);
        if (SPC) node.connect(int, 2);
        pub.airframe = node;
        params = AF.AF_PARAMS.map(n => node.parameters.get(n));
        ready = true;
      }, e => console.warn('flyDiy audio: the airframe voice did not load', e));
    },
    update(P, dt, api) {
      if (!ready) return;
      const tg = AF.airframeStep(P, st, dt);
      const lag = api.lagS ? api.lagS[0] : 0, t = ctx.currentTime + lag;   // SND-SPACE: heard when its sound arrives
      const tau = api.tauS && api.tauS[0] > TAU ? api.tauS[0] : TAU;   // G1724: the frame's tau (src_engine.js)
      if (tg[T.stall] > 0) {
        stallClk[0] += dt;
        if (!(stallClk[1] > 0) || stallClk[0] >= STALL_EMIT_S) { stallClk[0] = 0; stallClk[1] = 1; api.emit('stall', 1); }
      } else stallClk[1] = 0;
      if (SM) tg[T.duck] = samples(tg, t);
      // schedule only what moved (the targets are quantised: a steady frame reproduces them exactly)
      for (let i = 0; i < NP; i++) {
        const v = tg[i];
        if (v === last[i]) continue;
        if (discrete[i]) params[i].setValueAtTime(v, t); else params[i].setTargetAtTime(v, t, tau);
        last[i] = v;
      }
      // the events: a one-shot recording when its key resolved (asked on the first such event), the procedural always
      const n = st.evN[0];
      if (n > 0) {
        const E = st.ev;
        for (let k = 0; k < n; k++) {
          const o = k * AF.EV_W, e = E[o], s = E[o + 1];
          const key = EV_KEY[e];
          let rec = 0;
          if (SM && key) {
            const wh = E[o + 2] | 0, routes = EV_WHEEL && (e === 1 || e === 2) && wh < 2 ? EV_WHEEL[wh] : EV_OUT[e];
            if (SM.ready(key)) rec = SM.oneShot(key, routes, 0.3 + 0.7 * s) ? 1 : 0;
            else if (!evAsked[e] && SM.has(key)) { evAsked[e] = 1; SM.load(key); }
          }
          node.port.postMessage({ t: 'ev', e, s, a: E[o + 2], b: E[o + 3], k: rec, d: lag });
        }
        st.evN[0] = 0;
      }
    },
    disconnect() { teardown(); ctx = null; ready = false; if (SM) SM.detach(); SM = null; st.def = null; },
  });
  // SND-SPACE: a camera cut shortened the lag - drop what was scheduled further ahead, schedule afresh
  W.AUDIO.onEvent('space-cut', () => {
    if (!ctx || !params) return;
    for (const p of params) if (p && p.cancelScheduledValues) p.cancelScheduledValues(ctx.currentTime);
    last.fill(-1);
  });
})();
