// THE ENGINE SOURCE (Sound Coordinator integration, G1614; SOUND-2026-10-04 §2.1 / §3.1).
//
// Wires SND-ENGINE's piston voice (engine_worklet.js, 'flydiy-engine') into SND-CORE's window.AUDIO:
// one AudioWorkletNode per piston engine of the flown aeroplane, rebuilt when the aeroplane changes
// (P.def), fed every frame from the parameter block P (no sim reads here: audio_params already did them).
//   output 0  the voice (mono)  -> AUDIO.space.input('engine', i) (SND-SPACE, G1644: the exhaust's group - spatialised
//                                  outside, through the build's cabin transfer inside); without space.js, straight
//                                  to aircraft.ext and aircraft.int
//   SND-SPACE: every schedule time + AUDIO.lagS[0] (the sound's travel time), and a camera cut ('space-cut') drops
//   what was scheduled ahead; the doppler is space.js's, on the node's own `pitch` param (AUDIO.voices.engine[i])
//   output 1  control: engine rpm, prop rpm (the voice's own, cranking and run-down included) - SND-PROP's input
// Allocation-free per frame: the AudioParams are cached per voice, the warm-up clock is a typed slot.
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const MAX = 4, TAU = 0.03;
  const voices = [];                    // { node, params: [6 AudioParam], cfg }
  const runS = new Float64Array(MAX);   // seconds each engine has run (the voice's "cold")
  const last = new Float64Array(MAX * 6).fill(-1);
  let ctx = null, A = null, def = null, ready = false, building = false, outExt = null, outInt = null;
  const pub = (W.AUDIO.voices = W.AUDIO.voices || {}); pub.engine = [];   // SND-PROP: engine i's node (its output 1 drives the prop)

  function teardown() {
    for (const v of voices) { try { v.node.disconnect(); } catch (e) {} }
    voices.length = 0; last.fill(-1); pub.engine.length = 0;
  }
  function build(P) {
    teardown();
    def = P.def;
    const ES = W.ENGINE_SOUND, spec = def && def.spec;
    if (!ES || !spec || !ready) return;
    const kN = ES.engineSoundCountGain(ES.engineSoundPistonCount(spec));   // N engines: each -10 log10(N) dB (SND-ENGINE-2)
    for (let i = 0; i < Math.min(MAX, P.nE); i++) {
      let cfg;
      try { cfg = ES.engineSoundConfig(spec, i); } catch (e) { console.warn('flyDiy audio: engine ' + i + ' has no voice', e); continue; }
      if (!cfg || cfg.piston === false) continue;   // electric / turbine: SND-PROP's wave
      cfg.gain *= kN;
      const rpm = +P.rpmEng[i] || 0, running = (+P.running[i] || 0) > 0;
      const node = new AudioWorkletNode(ctx, 'flydiy-engine', {
        numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
        processorOptions: { config: cfg, seed: 1 + i, running, rpm },
      });
      const sp = A.space && A.space.input('engine', i);
      if (sp) node.connect(sp, 0); else { node.connect(outExt, 0); node.connect(outInt, 0); }
      const params = ES.ENGINE_SOUND_PARAMS.map(n => node.parameters.get(n));
      voices.push({ node, params, cfg, i });
      pub.engine[i] = node;
    }
  }

  W.AUDIO.addSource('engine', {
    connect(c, api) {
      ctx = c; A = api; ready = false;
      outExt = api.bus('aircraft.ext'); outInt = api.bus('aircraft.int');
      building = true;
      api.module('engine_worklet').then(ok => { ready = !!ok; building = false; def = null; },
        e => { building = false; console.warn('flyDiy audio: the engine voice did not load', e); });
    },
    update(P, dt) {
      if (!ready) return;
      if (P.def !== def) build(P);
      const t = ctx.currentTime + (A.lagS ? A.lagS[0] : 0);   // SND-SPACE: heard when its sound arrives
      // G1724: the frame's tau (audio.js tauS: 30 ms at 60 fps, up to 250 ms at 3-4 fps) - a lever that moves between frames
      // 0.3 s apart glides into its next value instead of a 30 ms step each frame (the load is the combustion's strength)
      const tau = A.tauS && A.tauS[0] > TAU ? A.tauS[0] : TAU;
      for (let k = 0; k < voices.length; k++) {
        const v = voices[k], i = v.i, o = k * 6;
        const running = (+P.running[i] || 0) > 0;
        runS[k] = running ? runS[k] + dt : 0;
        const vals0 = +P.rpmEng[i] || 0;
        const vals1 = running ? Math.min(1, Math.max(0, +P.thr[i] || 0)) : 0;
        const vals2 = running ? 1 : 0;
        const vals3 = (+P.crank[i] || 0) > 0 ? 1 : 0;
        const vals4 = (+P.s[P.I.starved] || 0) > 0 ? 1 : 0;
        const vals5 = running ? Math.max(0, 1 - runS[k] / 240) : 0;
        // schedule only what moved (a steady frame schedules nothing)
        if (Math.abs(vals0 - last[o]) > 0.5) { v.params[0].setTargetAtTime(vals0, t, tau); last[o] = vals0; }
        if (Math.abs(vals1 - last[o + 1]) > 0.002) { v.params[1].setTargetAtTime(vals1, t, tau); last[o + 1] = vals1; }
        if (vals2 !== last[o + 2]) { if (vals2 && last[o + 2] === 0) A.emit('engine', 'catch'); v.params[2].setValueAtTime(vals2, t); last[o + 2] = vals2; }   // G1672: the music ducks under a start
        if (vals3 !== last[o + 3]) { if (vals3) A.emit('engine', 'start'); v.params[3].setValueAtTime(vals3, t); last[o + 3] = vals3; }
        if (vals4 !== last[o + 4]) { v.params[4].setValueAtTime(vals4, t); last[o + 4] = vals4; }
        if (Math.abs(vals5 - last[o + 5]) > 0.01) { v.params[5].setTargetAtTime(vals5, t, 1); last[o + 5] = vals5; }
      }
    },
    disconnect() { teardown(); ctx = null; ready = false; def = null; },
  });
  // SND-SPACE: a camera cut shortened the lag - what was scheduled further ahead would land after the new values
  W.AUDIO.onEvent('space-cut', () => {
    if (!ctx) return;
    for (const v of voices) for (const p of v.params) if (p && p.cancelScheduledValues) p.cancelScheduledValues(ctx.currentTime);
    last.fill(-1);
  });
})();
