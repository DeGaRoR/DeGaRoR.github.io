// THE POSITIONAL EMITTERS (G1662, SND-AMB-2; SOUND-2026-10-04 §6.3 / §5 / §2.4).
//
// AUDIO.addSource('emitters') on the ambience bus. The decisions are emitters_model.js's (what calls, where, when: the
// species by habitat and hour, the world objects' declared sounds, the rate limits, the cap, the 150 m ceiling); this
// file plays them: the recorded one-shots G1636 ships (through samples.js's 'emit' class: lazy ASSET_FETCH after the
// gesture, kept decoded under the tier's budget, released when long unwanted) and four procedural sounds (the tram's
// rope hum and its station bell, the mill's rumble, an outboard at idle: no recording ships for them), made once, off
// the frame (an idle callback), when an object that wants them comes near.
//
//   THE GRAPH   per one-shot slot (6) and per loop slot (3), made at connect: gain -> AIR ABSORPTION low-pass -> PannerNode
//               -> emIn -> emLP -> emDuck -> AUDIO.bus('ambience'). Only the AudioBufferSourceNode is made per call (Web
//               Audio's sources play once).
//   THE SPACE   SND-SPACE's pattern (space.js): the panners placed in the CAMERA'S FRAME (its matrixWorld's columns; the
//               AudioListener never moves), equal-power (HRTF with the '3D on headphones' setting), inverse distance from
//               each sound's own reference distance, the air's absorption (SPACE_CONFIG.airAbsorptionHz's law, written
//               out in placeAt); a call bound to a moving object (a pickup's pass) rides it, its playbackRate x the
//               DOPPLER (c - vL.n) / (c - vS.n) (SPACE_CONFIG.dopplerFactor's) - a static call needs none.
//   THE MUFFLE  the ambience's rule (ambience.js): a closed cockpit -12 dB / 900 Hz, an open one -2 dB / 9 kHz, SND-SPACE's
//               insulation when it publishes one (AUDIO.cabin / the 'cabin' event); the garage and under water call
//               nothing (the model) and the loops fade.
//   THE OBJECTS the movers (tram cabins, traffic cars, moored boats) from render_premises' READ-ONLY soundObjects(out)
//               (window.WORLD.premises), every frame (a few dozen rows; a 10 Hz reader would run cold and box every double
//               it reads); the mill from the premises record (once per record).
//   THE FRAME   allocation-free (GATE AUDIO EMITALLOC): typed state, the AudioParams scheduled only when they moved; a
//               call is an event (its buffer source is the one allocation). Nothing near: nothing scheduled, nothing
//               loaded, nothing made.
//
// window.EMITTERS: { model, state, tier(), setTier(name), objects (the provider: replace it to drive the movers from
//   elsewhere), procBytes(), loading }
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const M = W.EMITTERS_MODEL, AM = W.AMBIENCE_MODEL;
  if (!M || !AM) return;
  const NV = M.NV, NL = M.NL, NS = M.NS, SOUNDS = M.SOUNDS;
  const PRESET_TIER = { potato: 'light', retro: 'mid' };
  const RELEASE_S = 60, RETRY_S = 15, POS_TAU = 0.05, GAIN_TAU = 0.4, MUFFLE_TAU = 0.08, C0 = 343;
  const CABIN = [Math.pow(10, -12 / 20), 900], OPEN = [Math.pow(10, -2 / 20), 9000], CLEAR = [1, 20000];
  const KEYS = []; for (let s = 0; s < NS; s++) if (SOUNDS[s][1]) KEYS.push(SOUNDS[s][1]);
  // the keys the emitters own in the 'emit' class (mech.creak stays the airframe's grain: shared, decoded once)
  const OWN = { 'bird.crow': 1, 'bird.eagle': 1, 'bird.gull': 1, 'bird.owl': 1, 'bird.loon': 1, 'dog': 1, 'mech.door': 1, 'vehicle.pickup': 1 };
  let st = M.emittersState('full'), tierName = 'full';
  let own = null;                                   // an ambience state of our own when the bed mixer is not there
  let ctx = null, SM = null, emIn = null, emLP = null, emDuck = null, offCabin = null, gen = 0;
  const V = new Array(NV).fill(null), LP = new Array(NL).fill(null);   // the slots' chains
  const vSrc = new Array(NV).fill(null), lSrc = new Array(NL).fill(null), lSnd = new Int16Array(NL).fill(-1);
  const vLast = new Float64Array(NV * 6).fill(-1e9), lLast = new Float64Array(NL * 6).fill(-1e9);
  const res = new Int8Array(NS);                    // per sound: 0 none, 1 loading / making, 2 ready, 3 refused (waits)
  const resT = new Float64Array(NS);                // since it was last wanted (2) / refused (3)
  const proc = new Array(NS).fill(null);            // the procedural buffers
  const procB = new Float64Array(1);
  const mu = new Float64Array(2).fill(-1), cab = new Float64Array(3);
  const Lf = new Float64Array(12);                  // the camera's frame: right, up, back (3 each)
  const DS = new Float64Array(2);                   // placeAt's distance
  const ABS_K = 29e-3 / (4000 * 4000);
  let loading = -1;
  const provider = {
    // the page's movers: render_premises' read-only accessor (the world editor's renderer; null when no premises)
    objects(out) { const WR = W.WORLD, R = WR ? WR.premises : null; return R && R.soundObjects ? R.soundObjects(out) : 0; },
  };

  function tierOf() { try { const G = W.GFX && W.GFX.get && W.GFX.get(); return (G && PRESET_TIER[G.preset]) || 'full'; } catch (e) { return 'full'; } }
  function applyTier(name) {
    tierName = M.TIERS[name] ? name : 'full';
    const T = M.TIERS[tierName];
    st.tier = tierName; st.cap = T.cap; st.loops = T.loops; st.budget = T.budget;
    if (SM) SM.setClass('emit', { budget: T.budget });
  }

  function chain(c) {
    const g = c.createGain(), lp = c.createBiquadFilter(), pan = c.createPanner();
    g.gain.value = 0;
    lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
    pan.panningModel = W.AUDIO.get && W.AUDIO.get('hrtf') ? 'HRTF' : 'equalpower';
    pan.distanceModel = 'inverse'; pan.refDistance = 10; pan.maxDistance = 10000; pan.rolloffFactor = 1;
    g.connect(lp); lp.connect(pan); pan.connect(emIn);
    return { g, lp, pan };
  }

  // ---- LOADING: the wanted keys (one fetch / decode at a time), the procedural buffers (one a idle callback) ---------
  function loads(dt) {
    const t = st.clk[0];
    for (let s = 0; s < NS; s++) {
      const want = st.want[s] === 1;
      if (want) resT[s] = t;
      const r = res[s];
      if (r === 3) { if (t - resT[s] > RETRY_S) { res[s] = 0; if (SOUNDS[s][1] && OWN[SOUNDS[s][1]]) SM.release(SOUNDS[s][1]); } continue; }
      if (r === 2 && !want && t - resT[s] > RELEASE_S && !playing(s)) { drop(s); continue; }
      if (r === 0 && want && loading < 0) begin(s);
    }
  }
  function playing(s) {
    for (let i = 0; i < NV; i++) if (st.vOn[i] && st.vS[i] === s) return true;
    for (let i = 0; i < NL; i++) if (lSnd[i] === s) return true;
    return false;
  }
  function begin(s) {
    const key = SOUNDS[s][1], g0 = gen;
    loading = s; res[s] = 1; resT[s] = st.clk[0];
    if (!key) {   // procedural: made in an idle callback (a few ms once), never in a frame
      const run = () => {
        if (g0 !== gen) return;
        if (loading === s) loading = -1;
        if (res[s] !== 1) return;
        const y = M.synth(SOUNDS[s][0], ctx.sampleRate);
        if (!y) { res[s] = 3; return; }
        const b = ctx.createBuffer(1, y.length, ctx.sampleRate);
        if (b.copyToChannel) b.copyToChannel(y, 0); else b.getChannelData(0).set(y);
        proc[s] = b; procB[0] += y.length * 4; res[s] = 2; st.ready[s] = 1; st.dur[s] = y.length / ctx.sampleRate;
      };
      if (W.requestIdleCallback) W.requestIdleCallback(run, { timeout: 1000 }); else setTimeout(run, 0);
      return;
    }
    if (!SM.has(key)) { loading = -1; res[s] = 3; return; }   // no recording (the loon): the emitter waits for one
    SM.load(key).then(buf => {
      if (g0 !== gen) return;
      if (loading === s) loading = -1;
      if (res[s] !== 1) return;
      if (!buf) { res[s] = 3; resT[s] = st.clk[0]; return; }
      // the longest variant's seconds (the model frees a slot when its call has played)
      let d = 0; const n = (W.FLYDIY_AUDIO_MEDIA && W.FLYDIY_AUDIO_MEDIA[key] && W.FLYDIY_AUDIO_MEDIA[key].length) || 1;
      for (let k = 0; k < 4 * n; k++) { const b = SM.pick(key); if (b && b.duration > d) d = b.duration; }
      st.dur[s] = d > 0 ? d : st.dur[s];
      res[s] = 2; st.ready[s] = 1;
    }, () => { if (g0 !== gen) return; if (loading === s) loading = -1; res[s] = 3; resT[s] = st.clk[0]; });
  }
  function drop(s) {
    res[s] = 0; st.ready[s] = 0;
    const key = SOUNDS[s][1];
    if (!key) { if (proc[s]) procB[0] -= proc[s].length * 4; proc[s] = null; return; }
    if (OWN[key]) SM.release(key);   // (a shared key - the airframe's creak - stays its owner's)
  }

  // ---- THE LISTENER'S FRAME and a panner placed in it ----------------------------------------------------------------
  function frameOf(cam) {
    const me = cam && cam.matrixWorld && cam.matrixWorld.elements;
    if (me) { Lf[0] = +me[0]; Lf[1] = +me[1]; Lf[2] = +me[2]; Lf[3] = +me[4]; Lf[4] = +me[5]; Lf[5] = +me[6]; Lf[6] = +me[8]; Lf[7] = +me[9]; Lf[8] = +me[10]; }
    else { Lf[0] = 1; Lf[1] = 0; Lf[2] = 0; Lf[3] = 0; Lf[4] = 1; Lf[5] = 0; Lf[6] = 0; Lf[7] = 0; Lf[8] = 1; }
  }
  // place slot i's panner (loop 0: a one-shot, 1: a loop) at its world point relative to the listener; schedule only what
  // moved (last[o..o+2]); the absorption on its low-pass (last[o+3]); the distance into DS[0]. (Indices, not doubles: a
  // double handed to a call V8 does not inline is a fresh heap box - the frame allocates nothing.)
  // THE AIR (SPACE_CONFIG.airAbsorptionHz, written out: ISO 9613-1's 29 dB/km at 4 kHz -> the corner sqrt(3 / (k d)),
  // 250 Hz .. 20 kHz) and THE DOPPLER (SPACE_CONFIG.dopplerFactor: (c - vL.n) / (c - vS.n), 0.5 .. 2)
  function placeAt(loop, i, tNow, snap) {
    const ch = loop ? LP[i] : V[i], pan = ch.pan, lp = ch.lp, last = loop ? lLast : vLast, o = i * 6;
    const x = loop ? st.lX[i] : st.vX[i], y = loop ? st.lY[i] : st.vY[i], z = loop ? st.lZ[i] : st.vZ[i];
    const L = st.L, rx = x - L[0], ry = y - L[1], rz = z - L[2];
    const px = rx * Lf[0] + ry * Lf[1] + rz * Lf[2], py = rx * Lf[3] + ry * Lf[4] + rz * Lf[5], pz = rx * Lf[6] + ry * Lf[7] + rz * Lf[8];
    const d = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (Math.abs(px - last[o]) + Math.abs(py - last[o + 1]) + Math.abs(pz - last[o + 2]) > 0.05 + 0.002 * d) {
      last[o] = px; last[o + 1] = py; last[o + 2] = pz;
      if (pan.positionX) {
        if (snap) { pan.positionX.setValueAtTime(px, tNow); pan.positionY.setValueAtTime(py, tNow); pan.positionZ.setValueAtTime(pz, tNow); }
        else { pan.positionX.setTargetAtTime(px, tNow, POS_TAU); pan.positionY.setTargetAtTime(py, tNow, POS_TAU); pan.positionZ.setTargetAtTime(pz, tNow, POS_TAU); }
      }
      else if (pan.setPosition) pan.setPosition(px, py, pz);
    }
    const f0 = Math.sqrt(3 / (ABS_K * (d > 1 ? d : 1))), fa = f0 > 20000 ? 20000 : f0 < 250 ? 250 : f0;
    if (Math.abs(fa - last[o + 3]) > 0.03 * fa) { last[o + 3] = fa; lp.frequency.setTargetAtTime(fa, tNow, POS_TAU); }
    DS[0] = d;
  }

  // ---- THE VOICES: start the new calls, ride the followers --------------------------------------------------------------
  function voices(tNow) {
    const L = st.L, t = st.clk[0];
    for (let i = 0; i < NV; i++) {
      if (!st.vOn[i]) { if (vSrc[i]) vSrc[i] = null; continue; }
      const ch = V[i], o = i * 6, s = st.vS[i];
      if (st.vNew[i]) {
        st.vNew[i] = 0;
        const buf = SOUNDS[s][1] ? SM.pick(SOUNDS[s][1]) : proc[s];
        if (!buf) { st.vOn[i] = 0; continue; }
        if (vSrc[i]) { try { vSrc[i].stop(); } catch (e) {} }
        const src = ctx.createBufferSource();
        src.buffer = buf; src.playbackRate.value = st.vR[i];
        src.connect(ch.g);
        ch.pan.refDistance = SOUNDS[s][4];
        vLast[o] = vLast[o + 1] = vLast[o + 2] = vLast[o + 3] = vLast[o + 4] = -1e9;
        // placed at once (no glide from the last call's place), its gain set, then started (a series' later calls wait)
        const delay = st.vT0[i] > t ? st.vT0[i] - t : 0;
        placeAt(0, i, tNow, 1);
        ch.g.gain.setValueAtTime(st.vG[i], tNow);
        src.start(tNow + delay);
        st.vT1[i] = st.vT0[i] + buf.duration / st.vR[i] + 0.05;
        vSrc[i] = src;
        continue;
      }
      if (st.vF[i] < 0) continue;   // a static call: placed once
      placeAt(0, i, tNow, 0);
      // the doppler on a mover: n from the source to the listener
      const rx = L[0] - st.vX[i], ry = L[1] - st.vY[i], rz = L[2] - st.vZ[i];
      const d = Math.sqrt(rx * rx + ry * ry + rz * rz), id = d > 1e-3 ? 1 / d : 0;
      const vsn = (st.vVx[i] * rx + st.vVy[i] * ry + st.vVz[i] * rz) * id, vln = (L[4] * rx + L[5] * ry + L[6] * rz) * id;
      const k0 = (C0 - vln) / (C0 - vsn), k = k0 === k0 ? (k0 < 0.5 ? 0.5 : k0 > 2 ? 2 : k0) : 1;
      const rate = st.vR[i] * k;
      if (Math.abs(rate - vLast[o + 4]) > 1e-3) { vLast[o + 4] = rate; vSrc[i].playbackRate.setTargetAtTime(rate, tNow, POS_TAU); }
    }
  }
  // ---- THE LOOPS: a looping source per slot while its sound is on --------------------------------------------------------
  function loopsFrame(tNow) {
    for (let i = 0; i < NL; i++) {
      const ch = LP[i], o = i * 6, s = st.lOn[i] ? st.lS[i] : -1;
      if (s !== lSnd[i]) {
        // the slot changed: the old loop stops (its gain was faded by the model before the slot freed)
        if (lSrc[i]) { try { lSrc[i].stop(tNow + 0.05); } catch (e) {} lSrc[i] = null; }
        lSnd[i] = -1; lLast[o + 4] = lLast[o + 5] = -1e9;
        if (s < 0 || !proc[s]) { if (s >= 0) lSnd[i] = -1; continue; }
        const src = ctx.createBufferSource();
        src.buffer = proc[s]; src.loop = true;
        src.connect(ch.g);
        ch.g.gain.setValueAtTime(0, tNow);
        ch.pan.refDistance = SOUNDS[s][4];
        lLast[o] = lLast[o + 1] = lLast[o + 2] = lLast[o + 3] = -1e9;
        placeAt(1, i, tNow, 1);
        src.start(tNow, (i * 0.613) % proc[s].duration);
        lSrc[i] = src; lSnd[i] = s;
      }
      if (lSnd[i] < 0) continue;
      placeAt(1, i, tNow, 0);
      const gq = Math.round(st.lG[i] * Math.pow(10, SOUNDS[s][3] / 20) * 500) / 500;
      if (gq !== lLast[o + 4]) { lLast[o + 4] = gq; ch.g.gain.setTargetAtTime(gq, tNow, GAIN_TAU); }
      const rq = Math.round(st.lR[i] * 200) / 200;
      if (rq !== lLast[o + 5]) { lLast[o + 5] = rq; lSrc[i].playbackRate.setTargetAtTime(rq, tNow, GAIN_TAU); }
    }
  }
  function muffle(P, tNow) {
    const s = P.s, I = P.I;
    let k = CLEAR[0], lp = CLEAR[1];
    if (s[I.interior] > 0 && !(s[I.inGarage] > 0)) {
      if (cab[0] > 0) { k = cab[1]; lp = cab[2]; }
      else if (s[I.open] > 0) { k = OPEN[0]; lp = OPEN[1]; }
      else { k = CABIN[0]; lp = CABIN[1]; }
    }
    if (k !== mu[0]) { mu[0] = k; emDuck.gain.setTargetAtTime(k, tNow, MUFFLE_TAU); }
    if (lp !== mu[1]) { mu[1] = lp; emLP.frequency.setTargetAtTime(lp, tNow, MUFFLE_TAU); }
  }
  function onCabin(d) {
    if (d && typeof d.outDb === 'number' && typeof d.outLpHz === 'number') { cab[0] = 1; cab[1] = Math.pow(10, d.outDb / 20); cab[2] = Math.max(200, d.outLpHz); }
    else cab[0] = 0;
  }

  function teardown() {
    gen++;
    for (let i = 0; i < NV; i++) { if (vSrc[i]) { try { vSrc[i].stop(); } catch (e) {} } vSrc[i] = null; st.vOn[i] = 0; st.vNew[i] = 0; }
    for (let i = 0; i < NL; i++) { if (lSrc[i]) { try { lSrc[i].stop(); } catch (e) {} } lSrc[i] = null; lSnd[i] = -1; st.lOn[i] = 0; }
    for (let s = 0; s < NS; s++) { if (res[s] === 2 || res[s] === 1) drop(s); res[s] = 0; st.ready[s] = 0; }
    procB[0] = 0; loading = -1; mu.fill(-1);
    for (const n of [emIn, emLP, emDuck]) { if (n) { try { n.disconnect(); } catch (e) {} } }
    emIn = emLP = emDuck = null; V.fill(null); LP.fill(null);
  }

  W.AUDIO.addSource('emitters', {
    connect(c, A) {
      ctx = c;
      SM = W.AUDIO_SAMPLES ? W.AUDIO_SAMPLES.attach(c) : null;
      if (SM) for (const k in OWN) SM.assign(k, 'emit');
      emIn = c.createGain(); emLP = c.createBiquadFilter(); emDuck = c.createGain();
      emLP.type = 'lowpass'; emLP.frequency.value = CLEAR[1]; emLP.Q.value = 0.5;
      emIn.connect(emLP); emLP.connect(emDuck); emDuck.connect(A.bus('ambience'));
      for (let i = 0; i < NV; i++) V[i] = chain(c);
      for (let i = 0; i < NL; i++) LP[i] = chain(c);
      applyTier(tierOf());
      if (A.cabin) onCabin(A.cabin);
      offCabin = A.onEvent('cabin', onCabin);
    },
    update(P, dt, A) {
      if (!ctx || !SM) return;
      let amb = W.AMBIENCE && W.AMBIENCE.state ? W.AMBIENCE.state : null;
      if (!amb) { if (!own) own = AM.ambienceState(); AM.ambienceStep(own, P, A.world, dt); amb = own; }
      M.emittersStep(st, P, amb, A.world, provider, dt, null);
      loads(dt);
      const tNow = ctx.currentTime;
      frameOf(A.camera);
      voices(tNow);
      loopsFrame(tNow);
      muffle(P, tNow);
    },
    disconnect() { teardown(); if (offCabin) offCabin(); offCabin = null; ctx = null; SM = null; },
  });

  W.EMITTERS = {
    model: M, get state() { return st; }, sounds: SOUNDS,
    tier: () => tierName, setTier(name) { applyTier(name); },
    objects: provider,
    resident: s => res[s], procBytes: () => procB[0],
    get loading() { return loading; },
  };
})();
