// ============================================================
// THE SPACE (G1640-G1646, SND-SPACE; SOUND-2026-10-04 §4 / §5, rulings s5 / s7): window.AUDIO_SPACE (= AUDIO.space) -
// the two perspectives, the cabin from the build, the headset, the exterior's space, the other aircraft, the shed's
// room. Its numbers are space_config.js's (pure, node-tested); this file makes the nodes and drives them per frame.
//
// THE GRAPH (made on the context, lazily - whichever of this file and the sources connects first)
//   per SOURCE GROUP (one per engine + one for the airframe), each kind of sound the group makes enters by
//   AUDIO.space.input(kind, i):  kind 'engine' (the piston / turbine / electric voice: the exhaust), 'propT' (the
//   prop's tonal part), 'propB' (its broadband part), 'airframe' (the wind, the ground, the water, the events)
//     input -> directivity gain (by kind) -> group sum -> AIR ABSORPTION low-pass -> PannerNode -> aircraft.ext
//     input -> the group's side (StereoPanner, lightly: a twin's engines left / right) -> THE CABIN
//   THE CABIN (cabinTransfer(spec), ruling s5): boom (peaking) -> high-shelf -> low-pass -> insulation gain -> int
//   AUDIO.space.interior() (int): what is heard inside without the cabin between - the airframe's structure-borne
//     output and its interior-only layers (stall warning, creaks, flap motor, lever) - and the cabin's output
//     int -> THE HEADSET (high-shelf, low-shelf, gain: 0 dB when off) -> aircraft.int (CORE's viewpoint fader)
//   THE SHED: aircraft, ambience, music -> wet sends (0 outside the shed) -> ConvolverNode (the IR generated from the
//     shed's own HW / HD / EAVE and shell, off the frame) -> master
//   OTHER AIRCRAFT (addCraft): baked loops -> per point gain -> layer directivity -> sum -> absorption -> panner ->
//     the world bus -> aircraft.ext and the cabin
// THE LISTENER = the camera: the panners are placed in the CAMERA'S FRAME (the AudioListener stays at the origin
//   facing -Z: one set of params per emitter a frame, and no listener API differences between browsers).
// THE PROPAGATION (per group, space_config.retardedSolve): a ring of the group's past positions; the group is heard
//   where it WAS (t - te = |x(te) - L| / c), its doppler (c - vL.n) / (c - vS.n) multiplies the worklets' k-rate
//   `pitch` (PannerNode's own doppler is gone from the spec), and the main group's delay becomes AUDIO.lagS[0] - the
//   seconds every source adds to its schedule times (the throttle you moved is heard when its sound arrives). The lag
//   rises freely, falls no faster than 0.5 s/s (a real pass falls at v/c < 0.3), and a camera cut snaps it and emits
//   'space-cut' (the sources then cancel what they scheduled ahead).
// THE FRAME allocates nothing: typed state, cached AudioParams, schedules only what moved.
// ============================================================
'use strict';
var AUDIO_SPACE = (function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const A = W.AUDIO;
  const SC = W.SPACE_CONFIG || (typeof SPACE_CONFIG !== 'undefined' ? SPACE_CONFIG : null);
  if (!A || !A.enabled || !SC) return null;   // ?audio=0: nothing at all
  const NG = 5, GAF = 4;                       // groups: engines 0..3, the airframe
  const KINDS = ['engine', 'propT', 'propB', 'airframe'];
  const KDIR = [SC.DIR_EXHAUST, SC.DIR_TONAL, SC.DIR_BROAD, SC.DIR_OMNI];
  const TAU = 0.03, POS_TAU = 0.02, PITCH_TAU = 0.04, ROOM_AHEAD = 8, CUT_M = 25, LAG_FALL = 0.5;
  // the shed's wet sends (the IR has unit energy): modest - the room under the sound, not over it
  const WET_AIRCRAFT = 0.25, WET_AMBIENCE = 0.16, WET_MUSIC = 0.12, WET_TAU = 0.3;
  const RING_CAP = 1024;                      // 1024 frames: ~17 s at 60 Hz (a 5 km path is 14.6 s)
  // G1715 (SND-ROLLOUT): A KINEMATIC MOVE OF THE FLOWN AEROPLANE IN THE SHED - the roll-out shot (rollanim.js, app.js hands
  // it this array) writes it every frame it plays: [0] on, [1..3] every emitter's offset from where sim.p stands it (the
  // roll; metres, the garage scene's frame), [4] the engines' share inside the shed (1 in, 0 out through the door). On, the
  // shed is heard as the world is: each group WHERE IT STANDS, through the same propagation, directivity, absorption and
  // panner as in flight (not the room mode's 8 m ahead), and the aircraft's wet send follows [4] down to WET_OUT of itself
  // as the engines leave by the door (the room still rings through the opening behind them)
  const shotPose = new Float64Array(5); shotPose[4] = 1;
  const WET_OUT = 0.3;

  let G = null;                               // the graph on the current context
  let def = null, cab = null, refD = 12, sideDone = 0, exits = 0;
  const grpNodes = new Array(NG).fill(null);  // per group: Int32Array of the solver's node indices
  let noseN = null, tailN = null;
  // the frame's typed state
  const T = new Float64Array(7);              // 0 clock, 1 lag, 2 garage poll, 3 interior was, 4 garage was, 5 dt, 6 c
  const L = new Float64Array(16);             // 0-2 position, 3-5 right, 6-8 up, 9-11 back, 12-14 velocity, 15 have
  const AT = new Float64Array(5), RS = new Float64Array(8), PB = new Float64Array(4), FWD = new Float64Array(3);
  const X3 = new Float64Array(4);              // the helpers' arguments (a double handed to a call V8 does not inline boxes)
  const SD = new Float64Array(8);              // G1680: SPACE_CONFIG's laws in their slot forms (cosT, dir | d, Hz | c, vs, vl, k)
  const rings = []; for (let g = 0; g < NG; g++) rings.push(SC.ringMake(RING_CAP));
  const LW = 12;                              // per group: 0-2 position, 3-6 directivity, 7 absorption Hz, 8 pitch, 9 dist
  const last = new Float64Array(NG * LW).fill(-1e9);
  const OUT = new Float64Array(NG * LW);      // the values this frame (for the gate and the dev panel)
  // the voices whose pitch a group drives (AUDIO.voices: the engine, the prop, the driver of engine i; the airframe)
  const pNode = new Array(NG * 3).fill(null), pParam = new Array(NG * 3).fill(null);
  const pLast = new Float64Array(NG * 3).fill(-1);
  const stats = { cuts: 0, irMade: 0, irMs: 0, crafts: 0, frames: 0 };

  // ---- THE GRAPH -------------------------------------------------------------------------------------------------
  const setP = (p, v) => { if (p.setValueAtTime && G) p.setValueAtTime(v, G.ctx.currentTime); else p.value = v; };
  function ensure() {
    const c = A.ctx;
    if (!c) return null;
    if (G && G.ctx === c) return G;
    G = build(c);
    return G;
  }
  function biq(c, type, f, Q, gain) {
    const b = c.createBiquadFilter(); b.type = type;
    b.frequency.value = f; if (b.Q) b.Q.value = Q; if (b.gain) b.gain.value = gain || 0;
    return b;
  }
  function build(c) {
    const g = { ctx: c, groups: new Array(NG).fill(null), conv: null, irKey: '', irPending: '' };
    G = g;
    // the cabin
    g.cabIn = c.createGain();
    g.boom = biq(c, 'peaking', 120, 1.2, 0); g.shelf = biq(c, 'highshelf', 2500, 0, 0); g.lp = biq(c, 'lowpass', 18000, -3.01, 0);
    g.cabGain = c.createGain(); g.cabGain.gain.value = 1;
    g.cabIn.connect(g.boom); g.boom.connect(g.shelf); g.shelf.connect(g.lp); g.lp.connect(g.cabGain);
    // the interior's own mix, then the headset, then CORE's viewpoint fader
    g.intIn = c.createGain();
    g.hsHi = biq(c, 'highshelf', 1500, 0, 0); g.hsLo = biq(c, 'lowshelf', 300, 0, 0); g.hsGain = c.createGain();
    g.cabGain.connect(g.intIn); g.intIn.connect(g.hsHi); g.hsHi.connect(g.hsLo); g.hsLo.connect(g.hsGain);
    g.hsGain.connect(A.bus('aircraft.int'));
    // the world bus (other aircraft): outside, and through the cabin
    g.world = c.createGain(); g.world.connect(A.bus('aircraft.ext')); g.world.connect(g.cabIn);
    // the shed: the wet sends into one convolver (no IR yet: it outputs silence)
    g.revA = c.createGain(); g.revAmb = c.createGain(); g.revMus = c.createGain(); g.revOut = c.createGain();
    g.revA.gain.value = g.revAmb.gain.value = g.revMus.gain.value = 0;
    A.bus('aircraft').connect(g.revA); A.bus('ambience').connect(g.revAmb); A.bus('music').connect(g.revMus);
    if (c.createConvolver) {
      g.conv = c.createConvolver(); g.conv.normalize = false;
      g.revA.connect(g.conv); g.revAmb.connect(g.conv); g.revMus.connect(g.conv); g.conv.connect(g.revOut);
    }
    g.revOut.connect(A.bus('master'));
    g.wet = new Float64Array(3).fill(-1);
    last.fill(-1e9); pLast.fill(-1); pNode.fill(null); pParam.fill(null);
    if (def) applyCabin();
    applyHeadset();
    return g;
  }
  function makeGroup(gi) {
    const c = G.ctx, gr = { sum: c.createGain(), lpf: biq(c, 'lowpass', 20000, -3.01, 0), pan: null, side: null,
                            ins: [null, null, null, null], dirs: [null, null, null, null] };
    gr.pan = makePanner(c);
    gr.side = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    gr.sum.connect(gr.lpf); gr.lpf.connect(gr.pan); gr.pan.connect(A.bus('aircraft.ext'));
    gr.side.connect(G.cabIn);
    G.groups[gi] = gr;
    sideDone = 0;   // the twin's sides are set once the group exists (the sources connect after their module loads)
    for (let k = 0; k < LW; k++) last[gi * LW + k] = -1e9;
    return gr;
  }
  function makePanner(c) {
    const p = c.createPanner();
    p.panningModel = A.get('hrtf') ? 'HRTF' : 'equalpower';
    p.distanceModel = 'inverse'; p.refDistance = refD; p.maxDistance = 10000; p.rolloffFactor = 1;
    p.coneInnerAngle = 360; p.coneOuterAngle = 360; p.coneOuterGain = 1;
    if (p.positionX) { p.positionX.value = 0; p.positionY.value = 0; p.positionZ.value = -refD; }
    else if (p.setPosition) p.setPosition(0, 0, -refD);
    return p;
  }
  // THE API FOR THE SOURCES: the node a kind of sound enters (made on demand)
  function input(kind, i) {
    if (!ensure()) return null;
    const k = KINDS.indexOf(kind);
    if (k < 0) return null;
    const gi = kind === 'airframe' ? GAF : Math.max(0, Math.min(3, i | 0));
    const gr = G.groups[gi] || makeGroup(gi);
    if (!gr.ins[k]) {
      const c = G.ctx;
      gr.ins[k] = c.createGain(); gr.dirs[k] = c.createGain();
      gr.ins[k].connect(gr.dirs[k]); gr.dirs[k].connect(gr.sum);
      gr.ins[k].connect(gr.side);
    }
    return gr.ins[k];
  }
  function interior() { return ensure() ? G.intIn : null; }

  // ---- THE CABIN AND THE HEADSET ----------------------------------------------------------------------------------
  function applyCabin() {
    cab = SC.cabinTransfer(def && def.spec, { exits });
    if (!G) return;
    const t = G.ctx.currentTime, st = (p, v) => (p.setTargetAtTime ? p.setTargetAtTime(v, t, 0.05) : (p.value = v));
    const boom = cab.filters.find(f => f.type === 'peaking');
    const sh = cab.filters.find(f => f.type === 'highshelf'), lp = cab.filters.find(f => f.type === 'lowpass');
    st(G.boom.frequency, boom ? boom.f : 120); st(G.boom.gain, boom ? boom.gain : 0); if (boom) G.boom.Q.value = boom.Q;
    st(G.shelf.frequency, sh.f); st(G.shelf.gain, sh.gain);
    st(G.lp.frequency, lp.f);
    st(G.cabGain.gain, Math.pow(10, cab.gainDb / 20));
  }
  function headsetKind() { return A.get('headset') ? (A.get('headsetAnr') ? 'anr' : 'passive') : 0; }
  function applyHeadset() {
    if (!G) return;
    const h = SC.headsetCurve(headsetKind()), t = G.ctx.currentTime;
    const st = (p, v) => (p.setTargetAtTime ? p.setTargetAtTime(v, t, 0.05) : (p.value = v));
    st(G.hsHi.gain, h.filters[0].gain); st(G.hsLo.gain, h.filters[1].gain);
    st(G.hsGain.gain, Math.pow(10, h.gainDb / 20));
    const model = A.get('hrtf') ? 'HRTF' : 'equalpower';
    for (const gr of G.groups) if (gr && gr.pan.panningModel !== model) gr.pan.panningModel = model;
    for (const cr of crafts) if (cr.voice && cr.voice.pan.panningModel !== model) cr.voice.pan.panningModel = model;
  }
  // CORE's ambience gain inside the cabin (audio.js applyGains): the build's insulation duck x the headset's mean
  function ambienceK(inn) {
    if (!inn) return 1;
    const k = cab ? cab.ambienceK : 1, hk = headsetKind();
    return k * (hk ? SC.headsetK(hk) : 1);
  }

  // ---- THE AEROPLANE ---------------------------------------------------------------------------------------------
  function resolve(d) {
    def = d; sideDone = 0;
    const R = (d && d.refs) || {}, P = (d && d.params) || {};
    const avgOf = a => (a && a.length ? Int32Array.from(a.filter(x => x >= 0)) : null);
    noseN = avgOf(R.noseFrame); tailN = avgOf(R.tailMid);
    const nE = Math.max(0, Math.min(4, P.nEngines || 1));
    for (let i = 0; i < 4; i++) {
      let list = null;
      if (i < nE && R.engine && R.engine.length) {
        const eo = R.engineOf || R.engine.map(() => 0), sel = [];
        for (let j = 0; j < R.engine.length; j++) if ((eo[j] | 0) === i) sel.push(R.engine[j]);
        if (sel.length) list = Int32Array.from(sel);
      }
      grpNodes[i] = list || (i < nE ? noseN : null);
    }
    grpNodes[GAF] = avgOf(R.origin) || noseN;
    refD = Math.max(6, Math.min(20, +P.viewDist || 12));
    for (let g = 0; g < NG; g++) SC.ringReset(rings[g]);
    if (G) for (const gr of G.groups) if (gr) gr.pan.refDistance = refD;
    applyCabin();
    if (A.refreshGains) A.refreshGains();
  }
  // the mean position of a node list into PB[1..3] (sim.p is the solver's flat array; a plain array reads alike)
  function avgInto(p, list, o) {
    let x = 0, y = 0, z = 0;
    const n = list.length;
    for (let k = 0; k < n; k++) { const j = list[k] * 3; x += +p[j]; y += +p[j + 1]; z += +p[j + 2]; }
    o[1] = x / n; o[2] = y / n; o[3] = z / n;
  }

  // ---- THE LISTENER (the camera) ----------------------------------------------------------------------------------
  function listener(cam, s, I, cut) {
    const dt = T[5];
    const x = s[I.listenerX], y = s[I.listenerY], z = s[I.listenerZ];
    const me = cam && cam.matrixWorld && cam.matrixWorld.elements;
    if (me) {   // THREE: column 0 right, 1 up, 2 back (the camera looks down -Z)
      L[3] = +me[0]; L[4] = +me[1]; L[5] = +me[2]; L[6] = +me[4]; L[7] = +me[5]; L[8] = +me[6];
      L[9] = +me[8]; L[10] = +me[9]; L[11] = +me[10];
    } else { L[3] = 1; L[4] = 0; L[5] = 0; L[6] = 0; L[7] = 1; L[8] = 0; L[9] = 0; L[10] = 0; L[11] = 1; }
    if (L[15] > 0 && !cut && dt > 1e-4) {
      const k = dt / (dt + 0.15);
      L[12] += ((x - L[0]) / dt - L[12]) * k; L[13] += ((y - L[1]) / dt - L[13]) * k; L[14] += ((z - L[2]) / dt - L[14]) * k;
    } else { L[12] = L[13] = L[14] = 0; }
    L[0] = x; L[1] = y; L[2] = z; L[15] = 1;
  }
  // the panner at X3[0..2] (the camera's frame)
  function placeRel(pan, o) {
    const t = G.ctx.currentTime, rx = X3[0], ry = X3[1], rz = X3[2];
    if (Math.abs(rx - last[o]) + Math.abs(ry - last[o + 1]) + Math.abs(rz - last[o + 2]) < 0.01) return;
    last[o] = rx; last[o + 1] = ry; last[o + 2] = rz;
    if (pan.positionX) {
      pan.positionX.setTargetAtTime(rx, t, POS_TAU); pan.positionY.setTargetAtTime(ry, t, POS_TAU); pan.positionZ.setTargetAtTime(rz, t, POS_TAU);
    } else if (pan.setPosition) pan.setPosition(rx, ry, rz);
  }
  // a gain toward X3[3] when it moved more than 0.005 (tau TAU)
  function schedK(p, o) {
    const v = X3[3];
    if (Math.abs(v - last[o]) <= 0.005) return;
    last[o] = v;
    p.setTargetAtTime(v, G.ctx.currentTime, TAU);
  }
  // the pitch of the voices a group drives (the doppler); slot q = gi * 3 + k
  function pitchSlot(q, node) {
    const v = X3[3];
    if (node !== pNode[q]) {
      pNode[q] = node; pLast[q] = -1;
      const pm = node && node.parameters && node.parameters.get ? node.parameters.get('pitch') : null;
      pParam[q] = pm || null;
    }
    const pm = pParam[q];
    if (!pm || Math.abs(v - pLast[q]) <= 2e-4) return;
    pLast[q] = v;
    pm.setTargetAtTime(v, G.ctx.currentTime, PITCH_TAU);
  }
  // the group's voices toward the doppler in X3[3]
  function pitchGroup(gi) {
    const vs = A.voices || null, q = gi * 3;
    if (gi === GAF) { pitchSlot(q, vs ? vs.airframe || null : null); return; }
    pitchSlot(q, vs && vs.engine ? vs.engine[gi] || null : null);
    pitchSlot(q + 1, vs && vs.prop ? vs.prop[gi] || null : null);
    pitchSlot(q + 2, vs && vs.driver ? vs.driver[gi] || null : null);
  }

  // ---- THE FRAME -------------------------------------------------------------------------------------------------
  function update(P, dt, api) {
    if (!ensure()) return;
    const s = P.s, I = P.I;
    if (P.def !== def) resolve(P.def);
    stats.frames++;
    const d0 = dt > 0 && dt < 1 ? dt : 0;
    const clk = T[0] += d0;
    const garage = s[I.inGarage] > 0 ? 1 : 0, inn = s[I.interior] > 0 ? 1 : 0;
    // a camera cut: the perspective or the shed changed, or the eye jumped
    const jx = s[I.listenerX] - L[0], jy = s[I.listenerY] - L[1], jz = s[I.listenerZ] - L[2];
    const cut = L[15] > 0 && (inn !== T[3] || garage !== T[4] || jx * jx + jy * jy + jz * jz > CUT_M * CUT_M) ? 1 : 0;
    T[3] = inn; T[4] = garage; T[5] = d0;
    listener(api && api.camera, s, I, cut);
    const c = s[I.c] > 100 ? s[I.c] : SC.C0;
    const sim = api && api.sim, p = sim && sim.p;
    const shot = garage && shotPose[0] > 0 ? 1 : 0;   // (G1715: the roll-out shot moves the aeroplane: heard where it is)
    const room = (garage && !shot) || !p || !noseN;
    // the aeroplane's nose (the directivity's axis): the nose frame less the tail post
    if (!room && tailN) {
      avgInto(p, noseN, PB); const nx = PB[1], ny = PB[2], nz = PB[3];
      avgInto(p, tailN, PB);
      let fx = nx - PB[1], fy = ny - PB[2], fz = nz - PB[3];
      const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
      FWD[0] = fx / fl; FWD[1] = fy / fl; FWD[2] = fz / fl;
      if (!sideDone && G) sides(p);
    }
    let lagT = 0, haveMain = 0;
    for (let gi = 0; gi < NG; gi++) {
      const gr = G.groups[gi], list = grpNodes[gi];
      if (!gr) continue;
      const o = gi * LW;
      let kDop = 1, cosT = 0, dist = ROOM_AHEAD, fAbs = 20000;
      if (room || !list) {
        // THE SHED (its scene is not the world's) or no aeroplane: the sound in front of the eye, no space
        SC.ringReset(rings[gi]);
        X3[0] = 0; X3[1] = 0; X3[2] = -ROOM_AHEAD; placeRel(gr.pan, o);
        X3[3] = 1;
        for (let k = 0; k < 4; k++) if (gr.dirs[k]) schedK(gr.dirs[k].gain, o + 3 + k);
      } else {
        avgInto(p, list, PB); PB[0] = clk;
        if (shot) { PB[1] += shotPose[1]; PB[2] += shotPose[2]; PB[3] += shotPose[3]; }
        // the emitter's own teleport (a respawn, the line-up): forget its past
        const R = rings[gi], h = R.n[1] * SC.RW;
        if (R.n[0] > 0) { const ex = PB[1] - R.a[h + 1], ey = PB[2] - R.a[h + 2], ez = PB[3] - R.a[h + 3]; if (ex * ex + ey * ey + ez * ez > 200 * 200) SC.ringReset(R); }
        SC.ringPush(R, PB);
        AT[0] = clk; AT[1] = L[0]; AT[2] = L[1]; AT[3] = L[2]; AT[4] = c;
        SC.retardedSolve(R, AT, RS);
        dist = RS[7];
        const rx = RS[1] - L[0], ry = RS[2] - L[1], rz = RS[3] - L[2];
        const id = dist > 1e-3 ? 1 / dist : 0;
        // n: from the source to the listener
        const nx = -rx * id, ny = -ry * id, nz = -rz * id;
        X3[0] = rx * L[3] + ry * L[4] + rz * L[5]; X3[1] = rx * L[6] + ry * L[7] + rz * L[8]; X3[2] = rx * L[9] + ry * L[10] + rz * L[11];
        placeRel(gr.pan, o);
        cosT = FWD[0] * nx + FWD[1] * ny + FWD[2] * nz;
        // (the laws in their slot forms: a double handed to or returned by a call the optimiser does not inline is boxed)
        SD[0] = cosT;
        for (let k = 0; k < 4; k++) if (gr.dirs[k]) { SC.dirAt(KDIR[k], SD, 0); X3[3] = SD[1]; schedK(gr.dirs[k].gain, o + 3 + k); }
        SD[2] = dist; SC.absorbAt(SD, 2); fAbs = SD[3];
        SD[4] = c; SD[5] = RS[4] * nx + RS[5] * ny + RS[6] * nz; SD[6] = L[12] * nx + L[13] * ny + L[14] * nz;
        SC.dopplerAt(SD, 4); kDop = SD[7];
        if (!haveMain && (gi === 0 || gi === GAF)) { lagT = RS[0]; haveMain = 1; }
      }
      if (Math.abs(fAbs - last[o + 7]) > 0.015 * fAbs) { last[o + 7] = fAbs; gr.lpf.frequency.setTargetAtTime(fAbs, G.ctx.currentTime, TAU); }
      X3[3] = kDop; pitchGroup(gi);
      OUT[o + 8] = kDop; OUT[o + 9] = dist; OUT[o + 7] = fAbs; OUT[o + 3] = cosT;
    }
    // THE LAG: rises freely, falls at most LAG_FALL s/s; a cut snaps it (and the sources drop what they scheduled ahead)
    if (inn || room) lagT = 0;
    let lag = T[1];
    if (lagT >= lag) lag = lagT;
    else if (cut || lag - lagT > 0.25) {
      lag = lagT; stats.cuts++;
      A.emit('space-cut');
    } else { lag -= LAG_FALL * d0; if (lag < lagT) lag = lagT; }
    T[1] = lag;
    if (A.lagS) A.lagS[0] = lag;
    // THE SHED: the wet sends while in it, the IR checked once a second (made off the frame)
    wet(garage, shot);
    if (garage) { T[2] -= d0; if (T[2] <= 0) { T[2] = 1; shedCheck(); } } else T[2] = 0;
    if (crafts.length) { T[6] = c; craftsFrame(); }   // (dt in T[5], c in T[6]: no double handed to a call)
  }
  // the engines' sides in the cabin (a twin's left engine leans left), once per aeroplane: the engine group's offset
  // along the aeroplane's right axis (up x aft, the solver's zRt), 3 m = 0.6
  function sides(p) {
    sideDone = 1;
    const R = def && def.refs; if (!R || !R.upLo || !R.upHi || !tailN) return;
    avgInto(p, R.upLo, PB); const lx = PB[1], ly = PB[2], lz = PB[3];
    avgInto(p, R.upHi, PB); let ux = PB[1] - lx, uy = PB[2] - ly, uz = PB[3] - lz;
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    // right = up x aft = up x (-fwd)
    const ax = -FWD[0], ay = -FWD[1], az = -FWD[2];
    const rx = uy * az - uz * ay, ry = uz * ax - ux * az, rz = ux * ay - uy * ax;
    avgInto(p, noseN, PB); const cx = PB[1], cy = PB[2], cz = PB[3];
    for (let gi = 0; gi < 4; gi++) {
      const gr = G.groups[gi], list = grpNodes[gi];
      if (!gr || !list || !gr.side.pan) continue;
      avgInto(p, list, PB);
      const off = (PB[1] - cx) * rx + (PB[2] - cy) * ry + (PB[3] - cz) * rz;
      gr.side.pan.value = Math.max(-0.6, Math.min(0.6, off / 3 * 0.6));
    }
  }

  // ---- THE SHED'S ROOM ------------------------------------------------------------------------------------------
  const WETS = [WET_AIRCRAFT, WET_AMBIENCE, WET_MUSIC];
  function wet(on, shot) {
    const ns = G.wetNodes || (G.wetNodes = [G.revA, G.revAmb, G.revMus]);   // (made once per graph: not an array a frame)
    // G1715: under the roll-out shot the aircraft's send follows the engines out of the door (in 2 % steps: no schedule a frame)
    const kA = shot ? Math.round((WET_OUT + (1 - WET_OUT) * shotPose[4]) * 50) / 50 : 1;
    for (let k = 0; k < 3; k++) {
      const v = on && G.irKey ? (k === 0 ? WETS[k] * kA : WETS[k]) : 0;
      if (G.wet[k] === v) continue;
      G.wet[k] = v;
      ns[k].gain.setTargetAtTime(v, G.ctx.currentTime, WET_TAU);
    }
  }
  // the shed's dims and shell (app.js's GARAGE_ENV, no app.js edit): a new key -> a new IR, generated in an idle callback
  function shedNow() {
    const GE = W.GARAGE_ENV;
    let d = null, sh = 'club';
    try { d = GE && GE.dims ? GE.dims() : null; sh = (GE && GE.shell ? GE.shell() : null) || 'club'; } catch (e) { d = null; }
    return { dims: d || (typeof HANGAR_DIMS !== 'undefined' ? HANGAR_DIMS : null) || { HW: 15, HD: 12.5, EAVE: 7 }, shell: sh };
  }
  function shedCheck() {
    if (!G || !G.conv) return;
    const S = shedNow(), D = S.dims;
    const key = S.shell + ':' + (+D.HW).toFixed(2) + ':' + (+D.HD).toFixed(2) + ':' + (+D.EAVE).toFixed(2);
    if (key === G.irKey || key === G.irPending) return;
    G.irPending = key;
    const g = G, run = () => {
      if (G !== g || g.irPending !== key) return;
      const t0 = (W.performance && W.performance.now) ? W.performance.now() : Date.now();
      const room = SC.hangarAcoustics(D, S.shell), ir = SC.hangarIR(room, g.ctx.sampleRate);
      const buf = g.ctx.createBuffer(2, ir.length, ir.sr);
      if (buf.copyToChannel) { buf.copyToChannel(ir.L, 0); buf.copyToChannel(ir.R, 1); }
      else { buf.getChannelData(0).set(ir.L); buf.getChannelData(1).set(ir.R); }
      g.conv.buffer = buf;
      g.irKey = key; g.irPending = ''; g.room = room;
      stats.irMade++; stats.irMs = ((W.performance && W.performance.now) ? W.performance.now() : Date.now()) - t0;
      g.wet.fill(-1);
    };
    if (W.requestIdleCallback) W.requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 0);
  }

  // ---- OTHER AIRCRAFT (§5: baked loops, MSFS's tiers) ----------------------------------------------------------
  // addCraft(id, specLike) -> a handle { id, st: Float64Array [x, y, z, fx, fy, fz, rpm, thr, on], state, tier }:
  // the caller (the fleet, the observatory) writes st - world position, the nose's direction, ENGINE rpm, the lever,
  // 1 = audible - whenever it likes (smoothed here: AI updates are sparse). At add, the craft's engine + prop voice is
  // rendered (the baker: an OfflineAudioContext with the same worklets in a page; setBaker(fn) in node) at 4-6 rpm
  // points into seamless loops, played resampled by rpm (x the doppler), the two points around the rpm blended at
  // equal power. Tiers per frame: <= 500 m FULL (engine + the prop's broadband layer), <= 5 km the ENGINE loop only,
  // beyond silent; at most 2 full + 8 baked voices, nearest first.
  const crafts = [];
  const CR_MAX = 32;
  const crDist = new Float64Array(CR_MAX), crOrder = new Int32Array(CR_MAX), crTier = new Uint8Array(CR_MAX);
  const BL = new Float64Array(5), CA = new Float64Array(5), CR = new Float64Array(8), CP = new Float64Array(4), CD = new Float64Array(12);
  let baker = null;
  function setBaker(fn) { baker = typeof fn === 'function' ? fn : null; }
  function craftCfg(specLike) {
    const S = specLike || {};
    if (S.engineCfg) return { engine: S.engineCfg, prop: S.propCfg || null };
    const spec = S.spec || S, ES = W.ENGINE_SOUND, PS = W.PROP_SOUND;
    const engine = ES ? ES.engineSoundConfig(spec, 0) : null;
    const pc = PS ? PS.propSoundConfig(spec, 0, undefined, S.prop || null) : null;
    return { engine, prop: pc ? pc.prop : null };
  }
  function addCraft(id, specLike, opt) {
    removeCraft(id);
    if (crafts.length >= CR_MAX) return null;
    const o = opt || {};
    const cfg = craftCfg(specLike);
    const e = cfg.engine || {};
    const nPts = Math.max(4, Math.min(6, o.points || 5));
    const points = SC.bakePoints(e.idleRpm > 0 ? e.idleRpm : 700, e.ratedRpm > 0 ? e.ratedRpm : 2500, nPts);
    const cr = { id, cfg, points, st: new Float64Array(9), ring: SC.ringMake(RING_CAP), rpmS: new Float64Array(2),
                 state: 'baking', tier: SC.TIER_SILENT, loops: null, buffers: null, voice: null, last: new Float64Array(24).fill(-1e9) };
    cr.st[8] = 1;
    crafts.push(cr); stats.crafts = crafts.length;
    const bk = baker || offlineBaker;
    const sr = o.sr || (A.ctx ? A.ctx.sampleRate : 48000);
    if (!cfg.engine || cfg.engine.piston === false) { cr.state = 'failed'; cr.why = 'no piston voice to bake'; return cr; }
    Promise.resolve().then(() => bk({ engine: cfg.engine, prop: cfg.prop, points, seconds: o.seconds || 1.6, sr, loopS: o.loopS || 1.0 }))
      .then(r => {
        if (crafts.indexOf(cr) < 0) return;
        const loopS = o.loopS || 1.0;
        cr.loops = { sr: r.sr, eng: r.eng.map(y => SC.makeLoop(y, r.sr, loopS, 0.15)), broad: (r.broad || []).map(y => SC.makeLoop(y, r.sr, loopS, 0.15)) };
        cr.state = 'ready';
      }, err => { cr.state = 'failed'; cr.why = String(err && err.message || err); });
    return cr;
  }
  function removeCraft(id) {
    for (let i = crafts.length - 1; i >= 0; i--) if (crafts[i].id === id) { dropVoice(crafts[i]); crafts.splice(i, 1); }
    stats.crafts = crafts.length;
  }
  // the page's baker: the same worklets in an OfflineAudioContext, one render per point (engine -> prop, the engine's
  // control output into the prop as in the flight; channel 0 the engine + the prop's tonal part, 1 the broadband)
  function offlineBaker(job) {
    const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
    if (!OAC || !W.AudioWorkletNode) return Promise.reject(new Error('no OfflineAudioContext'));
    const map = W.FLYDIY_AUDIO_SRC || {}, url = st => map[st] || ('src/viewer/audio/' + st + '.js');
    const n = Math.ceil(job.seconds * job.sr), eng = [], broad = [];
    const e = job.engine, pr = job.prop || {}, gear = e.gear > 0 ? e.gear : 1;
    let chain = Promise.resolve();
    job.points.forEach(rpm => {
      chain = chain.then(() => {
        const oc = new OAC(2, n, job.sr);
        return oc.audioWorklet.addModule(url('engine_worklet')).then(() => oc.audioWorklet.addModule(url('prop_worklet'))).then(() => {
          const load = Math.max(0.1, Math.min(1, (rpm - (e.idleRpm || 700)) / Math.max(1, (e.ratedRpm || 2500) - (e.idleRpm || 700))));
          const en = new W.AudioWorkletNode(oc, 'flydiy-engine', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
            processorOptions: { config: e, seed: 11, running: true, rpm } });
          en.parameters.get('rpm').value = rpm; en.parameters.get('load').value = load; en.parameters.get('running').value = 1;
          const pn = new W.AudioWorkletNode(oc, 'flydiy-prop', { numberOfInputs: 1, numberOfOutputs: 2, outputChannelCount: [1, 2],
            channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete', processorOptions: { config: pr, seed: 12 } });
          pn.parameters.get('rpm').value = rpm / gear; pn.parameters.get('thrust').value = load * (pr.Tstatic || 1000);
          pn.parameters.get('thr').value = load; pn.parameters.get('V').value = 30;
          en.connect(pn, 1, 0);
          const mg = oc.createChannelMerger(2), sp = oc.createChannelSplitter(2);
          en.connect(mg, 0, 0); pn.connect(sp, 1); sp.connect(mg, 0, 0); sp.connect(mg, 1, 1);
          mg.connect(oc.destination);
          return oc.startRendering();
        }).then(buf => { eng.push(buf.getChannelData(0).slice()); broad.push(buf.getChannelData(1).slice()); });
      });
    });
    return chain.then(() => ({ eng, broad, sr: job.sr }));
  }
  function makeVoice(cr, tier) {
    const c = G.ctx, L0 = cr.loops;
    if (!cr.buffers) {
      const mk = y => { const b = c.createBuffer(1, y.length, L0.sr); if (b.copyToChannel) b.copyToChannel(y, 0); else b.getChannelData(0).set(y); return b; };
      cr.buffers = { eng: L0.eng.map(mk), broad: L0.broad.map(mk) };
    }
    const v = { tier, sum: c.createGain(), lpf: biq(c, 'lowpass', 20000, -3.01, 0), pan: makePanner(c), layers: [] };
    v.pan.refDistance = 15;
    v.sum.connect(v.lpf); v.lpf.connect(v.pan); v.pan.connect(G.world);
    const nL = tier === SC.TIER_FULL && cr.buffers.broad.length ? 2 : 1;
    for (let l = 0; l < nL; l++) {
      const bufs = l === 0 ? cr.buffers.eng : cr.buffers.broad;
      const dir = c.createGain(); dir.connect(v.sum);
      const srcs = [], gains = [];
      for (let k = 0; k < bufs.length; k++) {
        const s = c.createBufferSource(); s.buffer = bufs[k]; s.loop = true;
        const g = c.createGain(); g.gain.value = 0;
        s.connect(g); g.connect(dir);
        // each point's loop starts at its own phase (no two loops in step)
        if (s.start) s.start(c.currentTime, (k * 0.137) % Math.max(0.01, bufs[k].duration || 1));
        srcs.push(s); gains.push(g);
      }
      v.layers.push({ dir, srcs, gains });
    }
    cr.voice = v; cr.last.fill(-1e9);
    SC.ringReset(cr.ring);
    return v;
  }
  function dropVoice(cr) {
    const v = cr.voice; if (!v) return;
    for (const l of v.layers) for (const s of l.srcs) { try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} }
    try { v.pan.disconnect(); } catch (e) {}
    cr.voice = null;
  }
  function craftsFrame() {
    const dt = T[5], c = T[6];
    const n = Math.min(crafts.length, CR_MAX);
    for (let i = 0; i < n; i++) {
      const cr = crafts[i], st = cr.st;
      const dx = st[0] - L[0], dy = st[1] - L[1], dz = st[2] - L[2];
      crDist[i] = cr.state === 'ready' && st[8] > 0 ? Math.sqrt(dx * dx + dy * dy + dz * dz) : 1e12;
    }
    SC.craftTiers(crDist, n, crOrder, crTier);
    const t = G.ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const cr = crafts[i], tier = crTier[i];
      if (tier !== cr.tier) { dropVoice(cr); cr.tier = tier; if (tier !== SC.TIER_SILENT) makeVoice(cr, tier); }
      const v = cr.voice; if (!v) continue;
      const st = cr.st, lw = cr.last;
      // the rpm, smoothed (an AI's parameters arrive sparse)
      const ks = dt / (dt + 0.3);
      cr.rpmS[0] = cr.rpmS[1] > 0 ? cr.rpmS[0] + (st[6] - cr.rpmS[0]) * ks : st[6]; cr.rpmS[1] = 1;
      CP[0] = T[0]; CP[1] = st[0]; CP[2] = st[1]; CP[3] = st[2];
      SC.ringPush(cr.ring, CP);
      CA[0] = T[0]; CA[1] = L[0]; CA[2] = L[1]; CA[3] = L[2]; CA[4] = c;
      SC.retardedSolve(cr.ring, CA, CR);
      const d = CR[7], id = d > 1e-3 ? 1 / d : 0;
      const rx = CR[1] - L[0], ry = CR[2] - L[1], rz = CR[3] - L[2], nx = -rx * id, ny = -ry * id, nz = -rz * id;
      const px = rx * L[3] + ry * L[4] + rz * L[5], py = rx * L[6] + ry * L[7] + rz * L[8], pz = rx * L[9] + ry * L[10] + rz * L[11];
      if (Math.abs(px - lw[0]) + Math.abs(py - lw[1]) + Math.abs(pz - lw[2]) > 0.05) {
        lw[0] = px; lw[1] = py; lw[2] = pz;
        if (v.pan.positionX) { v.pan.positionX.setTargetAtTime(px, t, POS_TAU); v.pan.positionY.setTargetAtTime(py, t, POS_TAU); v.pan.positionZ.setTargetAtTime(pz, t, POS_TAU); }
        else if (v.pan.setPosition) v.pan.setPosition(px, py, pz);
      }
      let fl = Math.sqrt(st[3] * st[3] + st[4] * st[4] + st[5] * st[5]) || 1;
      const cosT = (st[3] * nx + st[4] * ny + st[5] * nz) / fl;
      CD[0] = c; CD[1] = CR[4] * nx + CR[5] * ny + CR[6] * nz; CD[2] = L[12] * nx + L[13] * ny + L[14] * nz;
      SC.dopplerAt(CD, 0); const kDop = CD[3];
      CD[4] = d; SC.absorbAt(CD, 4); const fAbs = CD[5];
      if (Math.abs(fAbs - lw[3]) > 0.015 * fAbs) { lw[3] = fAbs; v.lpf.frequency.setTargetAtTime(fAbs, t, TAU); }
      BL[0] = cr.rpmS[0]; SC.loopBlendSlot(cr.points, BL);
      const i0 = BL[0] | 0, i1 = BL[1] | 0, u = BL[2];
      for (let l = 0; l < v.layers.length; l++) {
        const Ly = v.layers[l], o = 4 + l * 10;
        CD[8] = cosT; CD[10] = cosT;
        if (l === 0) { SC.dirAt(SC.DIR_EXHAUST, CD, 8); SC.dirAt(SC.DIR_TONAL, CD, 10); } else { SC.dirAt(SC.DIR_BROAD, CD, 8); CD[11] = CD[9]; }
        const gd = l === 0 ? 0.5 * (CD[9] + CD[11]) : CD[9];
        if (Math.abs(gd - lw[o]) > 0.005) { lw[o] = gd; Ly.dir.gain.setTargetAtTime(gd, t, TAU); }
        for (let k = 0; k < Ly.srcs.length; k++) {
          const g = k === i0 ? (i1 === i0 ? 1 : Math.cos(Math.PI / 2 * u)) : k === i1 ? Math.sin(Math.PI / 2 * u) : 0;
          const gq = Math.round(g * 200) / 200;
          if (gq !== lw[o + 1 + k]) { lw[o + 1 + k] = gq; Ly.gains[k].gain.setTargetAtTime(gq, t, 0.08); }
          if (g > 0) {
            const rate = (k === i0 ? BL[3] : BL[4]) * kDop;
            const pr = Ly.srcs[k].playbackRate;
            if (pr && Math.abs(rate - pr.value) > 1e-3) pr.setTargetAtTime(rate, t, PITCH_TAU);
          }
        }
      }
    }
  }

  // ---- REGISTRATION -----------------------------------------------------------------------------------------------
  const api = { input, interior, ambienceK, addCraft, removeCraft, setBaker, crafts: () => crafts.slice(), stats,
                cabin: () => cab, setExits(k) { exits = Math.max(0, Math.min(1, +k || 0)); applyCabin(); if (A.refreshGains) A.refreshGains(); },
                graph: () => G, frame: OUT, LW, NG, GAF, lag: () => T[1], room: () => (G && G.room) || null,
                // for the gate: the shed's IR now (synchronously), and the craft frame
                shedNow, shedCheck, shotPose };
  A.space = api;
  A.onEvent('settings', () => applyHeadset());
  A.addSource('space', {
    connect() { ensure(); },
    update,
    disconnect() { for (const cr of crafts) { dropVoice(cr); cr.buffers = null; cr.tier = SC.TIER_SILENT; } G = null; },
  });
  return api;
})();
if (typeof window !== 'undefined' && AUDIO_SPACE) window.AUDIO_SPACE = AUDIO_SPACE;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_SPACE;
