// THE PROP SOURCE (SND-PROP, G1621; SOUND-2026-10-04 §3.2-§3.4).
//
// Wires prop_worklet.js into SND-CORE's window.AUDIO, the way src_engine.js wires the piston voice:
// per engine of the flown aeroplane, rebuilt when the aeroplane changes (P.def), fed every frame from the
// parameter block P (no sim reads here: audio_params already did them).
//   'flydiy-prop'        one per engine. Input 0 = the DRIVER's control output 1 (engine rpm, prop rpm):
//                        a piston engine's node from src_engine.js (published as AUDIO.voices.engine[i] -
//                        the one-line hook there), re-wired whenever that node changes (its module may load
//                        after this one, its rebuild may land on another frame); or the turbine / electric
//                        driver made here.
//   'flydiy-turbine' / 'flydiy-electric'   the engine voice of the rows src_engine skips (cfg.piston false):
//                        made HERE, one per such engine, their output 1 into the prop.
//   output 0 (mono) of each -> aircraft.ext, and aircraft.int through a PLACEHOLDER cabin low-pass (SND-SPACE
//   replaces both with directivity and the build's cabin transfer, §4/§5; the prop's output 1 keeps the tonal
//   and broadband parts apart for it).
// Allocation-free per frame: AudioParams cached per voice, values through typed scratch, schedule only what moved.
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const MAX = 4, TAU = 0.03, CABIN_HZ = 1400, NP = 8, ND = 4;
  // the smallest change worth a schedule, per prop parameter (rpm thrust thr c V alpha beta interior);
  // thrust is relative to the static thrust (below)
  const EPS = [0.5, 0.005, 0.002, 0.5, 0.2, 0.002, 0.002, 0.5];
  const props = [];      // { node, params[8], i, Ts }
  const drivers = [];    // { node, params[4], i } (turbine / electric)
  const wired = [];      // per prop k: the driver node its input 0 listens to (null: not yet)
  const valP = new Float64Array(NP), valD = new Float64Array(ND);
  const lastP = new Float64Array(MAX * NP).fill(-1e9), lastD = new Float64Array(MAX * ND).fill(-1e9);
  let ctx = null, def = null, ready = false, cabin = null, outExt = null;

  function teardown() {
    for (const v of props) { try { v.node.disconnect(); } catch (e) {} }
    for (const v of drivers) { try { v.node.disconnect(); } catch (e) {} }
    for (let k = 0; k < wired.length; k++) {
      // a piston node is src_engine's: only our edge to the dead prop goes (disconnect(dest, output))
      const w = wired[k]; if (w && props[k] && w !== props[k].drv) { try { w.disconnect(props[k].node, 1); } catch (e) {} }
    }
    props.length = 0; drivers.length = 0; wired.length = 0; lastP.fill(-1e9); lastD.fill(-1e9);
  }
  function build(P) {
    teardown();
    def = P.def;
    const PS = W.PROP_SOUND, spec = def && def.spec;
    if (!PS || !spec || !ready) return;
    const prop = def.params && def.params.prop;
    for (let i = 0; i < Math.min(MAX, P.nE); i++) {
      let cfg;
      try { cfg = PS.propSoundConfig(spec, i, undefined, prop); } catch (e) { console.warn('flyDiy audio: prop ' + i + ' has no voice', e); continue; }
      const running = (+P.running[i] || 0) > 0, rpm = +P.rpm[i] || 0;
      let drv = null;
      if (cfg.driver === 'turbine' || cfg.driver === 'electric') {
        drv = new AudioWorkletNode(ctx, 'flydiy-' + cfg.driver, {
          numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
          processorOptions: { config: cfg[cfg.driver], seed: 1 + i, running, rpm },
        });
        drv.connect(outExt, 0); drv.connect(cabin, 0);
        drivers.push({ node: drv, params: PS.PROP_DRIVER_PARAMS.map(n => drv.parameters.get(n)), i });
      }
      const node = new AudioWorkletNode(ctx, 'flydiy-prop', {
        numberOfInputs: 1, numberOfOutputs: 2, outputChannelCount: [1, 2],
        channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete',
        processorOptions: { config: cfg.prop, seed: 101 + i },
      });
      node.connect(outExt, 0); node.connect(cabin, 0);
      props.push({ node, params: PS.PROP_SOUND_PARAMS.map(n => node.parameters.get(n)), i, Ts: cfg.prop.Tstatic, drv });
      wired.push(null);
    }
  }
  // the prop's input: its own driver, else src_engine's node for that engine (when it exists, and again
  // whenever it is a new one)
  function wire(k) {
    const v = props[k];
    const vs = W.AUDIO.voices, en = v.drv || (vs && vs.engine ? vs.engine[v.i] || null : null);
    if (en === wired[k]) return;
    const old = wired[k];
    if (old && old !== v.drv) { try { old.disconnect(v.node, 1); } catch (e) {} }
    if (en) en.connect(v.node, 1, 0);
    wired[k] = en;
  }

  W.AUDIO.addSource('prop', {
    connect(c, api) {
      ctx = c; ready = false;
      outExt = api.bus('aircraft.ext');
      cabin = c.createBiquadFilter(); cabin.type = 'lowpass'; cabin.frequency.value = CABIN_HZ; cabin.Q.value = 0.5;
      cabin.connect(api.bus('aircraft.int'));
      api.module('prop_worklet').then(ok => { ready = !!ok; def = null; },
        e => console.warn('flyDiy audio: the prop voice did not load', e));
    },
    update(P) {
      if (!ready) return;
      if (P.def !== def) build(P);
      const PS = W.PROP_SOUND, t = ctx.currentTime;
      for (let k = 0; k < props.length; k++) {
        const v = props[k], o = k * NP;
        wire(k);
        PS.propSoundInputs(P, v.i, valP, 0);
        for (let j = 0; j < NP; j++) {
          const x = valP[j];
          const eps = j === 1 ? EPS[1] * v.Ts : EPS[j];
          if (Math.abs(x - lastP[o + j]) <= eps) continue;
          lastP[o + j] = x;
          if (j === 7) v.params[j].setValueAtTime(x, t); else v.params[j].setTargetAtTime(x, t, TAU);
        }
      }
      for (let k = 0; k < drivers.length; k++) {
        const v = drivers[k], o = k * ND;
        PS.propDriverInputs(P, v.i, valD, 0);
        for (let j = 0; j < ND; j++) {
          const x = valD[j];
          if (Math.abs(x - lastD[o + j]) <= (j === 0 ? 0.5 : 0.002)) continue;
          lastD[o + j] = x;
          if (j >= 2) v.params[j].setValueAtTime(x, t); else v.params[j].setTargetAtTime(x, t, TAU);
        }
      }
    },
    disconnect() { teardown(); try { cabin && cabin.disconnect(); } catch (e) {} ctx = null; ready = false; def = null; },
  });
})();
