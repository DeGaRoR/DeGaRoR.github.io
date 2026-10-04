// THE ENGINE SOURCE (Sound Coordinator integration, G1614; SOUND-2026-10-04 §2.1 / §3.1).
//
// Wires SND-ENGINE's piston voice (engine_worklet.js, 'flydiy-engine') into SND-CORE's window.AUDIO:
// one AudioWorkletNode per piston engine of the flown aeroplane, rebuilt when the aeroplane changes
// (P.def), fed every frame from the parameter block P (no sim reads here: audio_params already did them).
//   output 0  the voice (mono)  -> aircraft.ext, and aircraft.int through a placeholder cabin low-pass
//                                  (SND-SPACE replaces it with the build's cabin transfer, §4)
//   output 1  control: engine rpm, prop rpm (the voice's own, cranking and run-down included) - SND-PROP's input
// Allocation-free per frame: the AudioParams are cached per voice, the warm-up clock is a typed slot.
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const MAX = 4, TAU = 0.03, CABIN_HZ = 1400;
  const voices = [];                    // { node, params: [6 AudioParam], cfg }
  const runS = new Float64Array(MAX);   // seconds each engine has run (the voice's "cold")
  const last = new Float64Array(MAX * 6).fill(-1);
  let ctx = null, A = null, def = null, ready = false, building = false, cabin = null, outExt = null, outInt = null;

  function teardown() {
    for (const v of voices) { try { v.node.disconnect(); } catch (e) {} }
    voices.length = 0; last.fill(-1);
  }
  function build(P) {
    teardown();
    def = P.def;
    const ES = W.ENGINE_SOUND, spec = def && def.spec;
    if (!ES || !spec || !ready) return;
    for (let i = 0; i < Math.min(MAX, P.nE); i++) {
      let cfg;
      try { cfg = ES.engineSoundConfig(spec, i); } catch (e) { console.warn('flyDiy audio: engine ' + i + ' has no voice', e); continue; }
      if (!cfg || cfg.piston === false) continue;   // electric / turbine: SND-PROP's wave
      const rpm = +P.rpmEng[i] || 0, running = (+P.running[i] || 0) > 0;
      const node = new AudioWorkletNode(ctx, 'flydiy-engine', {
        numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
        processorOptions: { config: cfg, seed: 1 + i, running, rpm },
      });
      node.connect(outExt, 0);
      node.connect(cabin, 0);
      const params = ES.ENGINE_SOUND_PARAMS.map(n => node.parameters.get(n));
      voices.push({ node, params, cfg, i });
    }
  }

  W.AUDIO.addSource('engine', {
    connect(c, api) {
      ctx = c; A = api; ready = false;
      outExt = api.bus('aircraft.ext'); outInt = api.bus('aircraft.int');
      cabin = c.createBiquadFilter(); cabin.type = 'lowpass'; cabin.frequency.value = CABIN_HZ; cabin.Q.value = 0.5;
      cabin.connect(outInt);
      building = true;
      api.module('engine_worklet').then(ok => { ready = !!ok; building = false; def = null; },
        e => { building = false; console.warn('flyDiy audio: the engine voice did not load', e); });
    },
    update(P, dt) {
      if (!ready) return;
      if (P.def !== def) build(P);
      const t = ctx.currentTime;
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
        if (Math.abs(vals0 - last[o]) > 0.5) { v.params[0].setTargetAtTime(vals0, t, TAU); last[o] = vals0; }
        if (Math.abs(vals1 - last[o + 1]) > 0.002) { v.params[1].setTargetAtTime(vals1, t, TAU); last[o + 1] = vals1; }
        if (vals2 !== last[o + 2]) { v.params[2].setValueAtTime(vals2, t); last[o + 2] = vals2; }
        if (vals3 !== last[o + 3]) { v.params[3].setValueAtTime(vals3, t); last[o + 3] = vals3; }
        if (vals4 !== last[o + 4]) { v.params[4].setValueAtTime(vals4, t); last[o + 4] = vals4; }
        if (Math.abs(vals5 - last[o + 5]) > 0.01) { v.params[5].setTargetAtTime(vals5, t, 1); last[o + 5] = vals5; }
      }
    },
    disconnect() { teardown(); try { cabin && cabin.disconnect(); } catch (e) {} ctx = null; ready = false; def = null; },
  });
})();
