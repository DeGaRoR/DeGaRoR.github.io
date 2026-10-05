// THE AMBIENCE SOURCE (G1651, SND-AMB-1; SOUND-2026-10-04 §6 / §2.4).
//
// The bed mixer: AUDIO.addSource('ambience') on the ambience bus. The numbers are ambience_model.js's (the world
// around the LISTENER read one item a frame, a round every ~0.5 s, one target weight per bed, smoothed over seconds);
// this file plays them with the recorded beds G1636 ships, through samples.js's 'amb' class (lazy ASSET_FETCH after the
// gesture, decodeAudioData, the loop's equal-power crossfade BAKED once - never a codec seam - and its own budget).
//
//   THE GRAPH   outside beds -> outIn -> outLP (lowpass) -> outDuck -> AUDIO.bus('ambience')
//               room beds (hangar, roof rain) -> roomIn -> AUDIO.bus('ambience')
//               THE MUFFLE (outLP / outDuck): in the cockpit of a closed cabin the outside is ducked and darkened -
//               SND-SPACE's insulation when it publishes one (AUDIO.cabin = { outDb, outLpHz }, or an AUDIO 'cabin'
//               event with the same detail), else the fallback (-12 dB, 900 Hz; an open cockpit -2 dB, 9 kHz); the
//               garage hears the outside through its door (-6 dB, 2.5 kHz); under water (-3 dB, 350 Hz).
//   LOADING BY PROXIMITY (the tier's N and budget, from the graphics preset: potato -> light, retro -> mid, the rest
//               -> full; AMBIENCE.setTier): the beds RANKED by target gain (a resident one ranked x1.5: no thrash), the
//               top N above the floor are wanted. ONE fetch / decode at a time (the transient decode stays one bed's).
//               A wanted bed with no free slot takes the slot of a resident outside the top N: that one FADES OUT (0.4 s)
//               and is released 1.2 s later. A resident silent for RELEASE_S is released anyway. A refusal (budget or a
//               failed fetch) waits RETRY_S. Nothing before the gesture: connect() runs after it (AUDIO's contract), and
//               nothing is asked before the first frame after it.
//   THE FRAME   the model (one probe item, the targets), then the plan and the gains: a gain is scheduled only when its
//               quantised value moved (the weights move once a round: a frame between rounds schedules nothing).
//               Allocation-free (GATE AUDIO AMBALLOC); the load's promise callbacks run on an event, never a frame.
//
// window.AMBIENCE: { model, state (the model's st), tier(), setTier('full' | 'mid' | 'light'), rain(v) (0..1, the
//   CLIMATE hook: the roof's rain in the garage; -1 hands it back to world.day.precip), resident(b) (0 none,
//   1 loading, 2 playing, 3 refused, 4 fading out), gain(b) (what was last scheduled) }
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  if (!W.AUDIO || !W.AUDIO.enabled) return;   // ?audio=0: nothing at all
  const M = W.AMBIENCE_MODEL;
  if (!M) return;
  const NB = M.NB, BEDS = M.BEDS, FLOOR = M.AM_FLOOR;
  const MB = 1024 * 1024;
  // THE TIERS (§2.4: decoded ambience <= 24 MB gamer, <= 8 MB potato / pocket): budget, N decoded at once, the loop's
  // length cap (s) and the rate divider. A loop's length is also cut so N of them fit the budget at the context's rate.
  const TIERS = {
    full: { budget: 24 * MB, n: 6, maxS: 20, decim: 1 },
    mid: { budget: 12 * MB, n: 4, maxS: 15, decim: 1 },
    light: { budget: 8 * MB, n: 3, maxS: 20, decim: 2 },
  };
  const PRESET_TIER = { potato: 'light', retro: 'mid' };
  const RELEASE_S = 12, RETRY_S = 10, FADE_S = 1.2, GAIN_TAU = 0.3, FADE_TAU = 0.15, MUFFLE_TAU = 0.08;
  const DOOR = [Math.pow(10, -6 / 20), 2500], UNDER = [Math.pow(10, -3 / 20), 350];
  const CABIN = [Math.pow(10, -12 / 20), 900], OPEN = [Math.pow(10, -2 / 20), 9000], CLEAR = [1, 20000];
  const st = M.ambienceState();
  const res = new Int8Array(NB);           // 0 none, 1 loading, 2 playing, 3 refused (waits), 4 fading out
  const tmr = new Float64Array(NB);        // per bed: the seconds silent (2), since the refusal (3), fading (4)
  const lastG = new Float64Array(NB).fill(-1);
  const rank = new Float64Array(NB), has = new Uint8Array(NB);
  const players = new Array(NB).fill(null);
  const mu = new Float64Array(4).fill(-1);  // the muffle last scheduled: duck, lp
  const cab = new Float64Array(3);          // SND-SPACE's insulation from the 'cabin' event: [set, k, lpHz]
  let ctx = null, SM = null, outIn = null, outLP = null, outDuck = null, roomIn = null, offCabin = null;
  let tierName = 'full', T0 = TIERS.full, loading = -1, gen = 0;

  function tierOf() {
    try { const G = W.GFX && W.GFX.get && W.GFX.get(); return (G && PRESET_TIER[G.preset]) || 'full'; } catch (e) { return 'full'; }
  }
  function applyTier(name) {
    tierName = TIERS[name] ? name : 'full'; T0 = TIERS[tierName];
    if (!SM || !ctx) return;
    const sr = (ctx.sampleRate || 48000) / T0.decim;
    const fit = Math.floor(T0.budget / (T0.n * sr * 4)) - 1.6;   // N loops (+ the 1.5 s crossfade tail) inside the budget
    SM.setClass('amb', { budget: T0.budget, maxS: Math.max(6, Math.min(T0.maxS, fit)), decim: T0.decim });
  }

  function drop(b) {
    const p = players[b];
    if (p) p.stop();
    players[b] = null; res[b] = 0; tmr[b] = 0; lastG[b] = -1;
    if (SM) SM.release(BEDS[b][0]);
  }
  function start(b) {
    const key = BEDS[b][0], g0 = gen;
    res[b] = 1; loading = b;
    SM.load(key).then(buf => {
      if (g0 !== gen) return;
      if (loading === b) loading = -1;
      if (res[b] !== 1) { SM.release(key); return; }
      if (!buf) { res[b] = 3; tmr[b] = 0; return; }   // the budget or a failed fetch: wait, then ask again
      const p = SM.loop(key, BEDS[b][3] ? roomIn : outIn);
      if (!p) { res[b] = 3; tmr[b] = 0; return; }
      players[b] = p; res[b] = 2; tmr[b] = 0; lastG[b] = -1;
    }, () => { if (g0 !== gen) return; if (loading === b) loading = -1; res[b] = 3; tmr[b] = 0; });
  }

  // THE PLAN, every frame (cheap, and hot: a twice-a-second function would box its doubles): the top N wanted
  function plan(dt) {
    const w = st.w, t = st.t, lv = st.lv, N = T0.n;
    let n = 0;
    for (let b = 0; b < NB; b++) {
      const r = res[b];
      rank[b] = has[b] && r !== 3 && r !== 4 ? t[b] * lv[b] * (r === 1 || r === 2 ? 1.5 : 1) : 0;
      if (r === 1 || r === 2 || r === 4) n++;
    }
    let waiting = -1, wv = 0;
    for (let b = 0; b < NB; b++) {
      const r = res[b], sc = rank[b];
      let above = 0;
      for (let c = 0; c < NB; c++) if (rank[c] > sc || (rank[c] === sc && c < b)) above++;
      const top = sc > FLOOR && above < N;
      const g = w[b] * lv[b];
      if (r === 2) {
        if (top || g >= FLOOR) tmr[b] = 0; else tmr[b] += dt;
        if (tmr[b] >= RELEASE_S) { drop(b); n--; }
      } else if (r === 3) {
        tmr[b] += dt;
        if (tmr[b] >= RETRY_S) { if (SM) SM.release(BEDS[b][0]); res[b] = 0; tmr[b] = 0; }
      } else if (r === 4) {
        tmr[b] += dt;
        if (tmr[b] >= FADE_S) { drop(b); n--; }
      } else if (r === 0 && top && sc > wv) { wv = sc; waiting = b; }
    }
    if (waiting < 0 || loading >= 0) return;
    if (n >= N) {
      // no free slot: the resident with the lowest rank outside the top N fades out (its slot frees in FADE_S)
      let ev = -1, evr = 1e9;
      for (let b = 0; b < NB; b++) if (res[b] === 2 && rank[b] < evr) { evr = rank[b]; ev = b; }
      if (ev >= 0 && evr < wv) { res[ev] = 4; tmr[ev] = 0; }
      return;
    }
    start(waiting);
  }

  // THE GAINS and THE MUFFLE: scheduled only when they moved
  function gains(tNow, P) {
    const w = st.w, lv = st.lv;
    for (let b = 0; b < NB; b++) {
      const r = res[b];
      if (r !== 2 && r !== 4) continue;
      const g = r === 4 ? 0 : Math.round(w[b] * lv[b] * 2000) / 2000;
      if (g === lastG[b]) continue;
      lastG[b] = g;
      players[b].gain.setTargetAtTime(g, tNow, r === 4 ? FADE_TAU : GAIN_TAU);
    }
    const s = P.s, I = P.I, f = st.f;
    let k = CLEAR[0], lp = CLEAR[1];
    if (s[I.inGarage] > 0) { k = DOOR[0]; lp = DOOR[1]; }
    else if (f[M.F.under] > 0) { k = UNDER[0]; lp = UNDER[1]; }
    else if (s[I.interior] > 0) {
      if (cab[0] > 0) { k = cab[1]; lp = cab[2]; }
      else if (s[I.open] > 0) { k = OPEN[0]; lp = OPEN[1]; }
      else { k = CABIN[0]; lp = CABIN[1]; }
    }
    if (k !== mu[0]) { mu[0] = k; outDuck.gain.setTargetAtTime(k, tNow, MUFFLE_TAU); }
    if (lp !== mu[1]) { mu[1] = lp; outLP.frequency.setTargetAtTime(lp, tNow, MUFFLE_TAU); }
  }
  // SND-SPACE's insulation, when it says it: { outDb, outLpHz } (null hands it back to the fallback)
  function onCabin(d) {
    if (d && typeof d.outDb === 'number' && typeof d.outLpHz === 'number') { cab[0] = 1; cab[1] = Math.pow(10, d.outDb / 20); cab[2] = Math.max(200, d.outLpHz); }
    else cab[0] = 0;
  }

  function teardown() {
    gen++;
    for (let b = 0; b < NB; b++) { if (players[b]) players[b].stop(); players[b] = null; if (SM && res[b]) SM.release(BEDS[b][0]); res[b] = 0; tmr[b] = 0; }
    lastG.fill(-1); mu.fill(-1); loading = -1;
    for (const n of [outIn, outLP, outDuck, roomIn]) { if (n) { try { n.disconnect(); } catch (e) {} } }
    outIn = outLP = outDuck = roomIn = null;
  }

  W.AUDIO.addSource('ambience', {
    connect(c, A) {
      ctx = c;
      SM = W.AUDIO_SAMPLES ? W.AUDIO_SAMPLES.attach(c) : null;
      const bus = A.bus('ambience');
      outIn = c.createGain(); outLP = c.createBiquadFilter(); outDuck = c.createGain(); roomIn = c.createGain();
      outLP.type = 'lowpass'; outLP.frequency.value = CLEAR[1]; outLP.Q.value = 0.5;
      outIn.connect(outLP); outLP.connect(outDuck); outDuck.connect(bus); roomIn.connect(bus);
      for (let b = 0; b < NB; b++) has[b] = SM && SM.has(BEDS[b][0]) ? 1 : 0;
      applyTier(tierOf());
      if (A.cabin) onCabin(A.cabin);
      offCabin = A.onEvent('cabin', onCabin);
    },
    update(P, dt, A) {
      if (!ctx || !SM) return;
      M.ambienceStep(st, P, A.world, dt);
      plan(dt > 0 && dt < 1 ? dt : 0);
      gains(ctx.currentTime, P);
    },
    disconnect() { teardown(); if (offCabin) offCabin(); offCabin = null; ctx = null; SM = null; },
  });

  W.AMBIENCE = {
    model: M, state: st, beds: BEDS,
    tier: () => tierName,
    setTier(name) { applyTier(name); },
    rain(v) { st.clk[11] = v == null || v < 0 ? -1 : Math.min(1, +v || 0); },
    resident: b => res[b], gain: b => lastG[b],
    get loading() { return loading; },
  };
})();
