// ============================================================
// THE SPACE'S NUMBERS (G1640, SND-SPACE; SOUND-2026-10-04 §4 / §5 / ruling s5). PURE: no Web Audio, no DOM, runs in
// node - GATE AUDIO tests every function here, tools/audio/space_render.js renders the evidence with them, and
// space.js (the page) builds its nodes from them. Nothing here is per-frame except the small numeric helpers, which
// take and return numbers only through typed arrays where they sit on the frame's path (a double handed to a call V8
// does not inline is a fresh heap box - G1602's finding).
//
//   cabinTransfer(spec, opt)   THE CABIN FROM THE BUILD (ruling s5): what the fuselage is made of (spec.material, else
//                              spec.fuselage.material) and whether it is glazed (cabin.glazing 'none' = an open
//                              cockpit) -> a construction class -> the insulation of outside sound (dB, the mean over
//                              the 250 / 500 / 1k / 2k octaves) and the filter shape that gives it: a cabin BOOM
//                              (peaking, the first transverse mode c / 2W of the cabin's own width, clamped 80-150 Hz,
//                              on the stiff shells only), a high-shelf (the high-frequency loss), a low-pass corner and
//                              the broadband gain solved so the mean is exactly the class's insulation. opt.exits 0..1
//                              (a door / window open in flight - MSFS's "exits open") blends toward the open cockpit.
//   headsetCurve(kind)         a passive headset (more cut at high frequency, ~15 dB mean) and a gentle ANR variant
//                              (a low-shelf on top: the low end goes too) as biquads + gain; headsetK(kind) its mean as
//                              one gain (the ambience's share).
//   biquadDb / chainDb         the magnitude of a BiquadFilterNode chain, with the Web Audio spec's own coefficient
//                              formulas (RBJ cookbook) - the gate and the evidence read the cabin's real response.
//   dopplerFactor(c, vs, vl)   (c - vl) / (c - vs), radial speeds toward the other end (m/s); the moving-source case
//                              c / (c - v_r) at a fixed listener.
//   airAbsorptionHz(d)         the low-pass corner of the air between source and listener: ISO 9613-1's absorption
//                              grows ~ f^2 above 1 kHz (29 dB/km at 4 kHz, 20 C 70 % RH), the corner is where the
//                              path loses 3 dB: sqrt(3 / (k d)), 20 kHz near, ~1.3 kHz at 1 km, ~580 Hz at 5 km.
//   directivity(kind, cosT)    the radiation pattern, cosT = the cosine of the angle between the aeroplane's nose and the
//                              direction to the listener: DIR_EXHAUST aft-biased (MSFS's combustion cone heading 180),
//                              DIR_TONAL the prop's loading tones (Gutin: nil on the axis, the peak ~104 deg = 14 deg
//                              behind the disc plane), DIR_BROAD the prop's broadband (a dipole's in-plane bias, -6 dB
//                              on the axis), DIR_OMNI the airframe.
//   retardedSolve(R, at, out)  THE PROPAGATION: a ring of the emitter's past (t, x, y, z, vx, vy, vz) and the listener
//                              now -> the emission time te with t - te = |x(te) - L| / c (fixed point, a contraction
//                              since v / c < 1), the position and the velocity THEN: the aeroplane is heard where it
//                              was, and its doppler is the one of that moment.
//   xfadeCurve(dst, x0, x1)    the equal-power cross-fade (sin / cos), endpoints exact.
//   hangarAcoustics(dims, shell) / hangarIR(...)   THE SHED'S ROOM: genHangarBuild's HW / HD / EAVE (half-dims) and the
//                              shell's wall / roof materials -> volume, surfaces, Sabine RT60 per octave (+ the air's
//                              4mV and the open front door, alpha 1) -> an exponentially decaying, octave-filtered noise
//                              IR, two independent noises (stereo-decorrelated), unit energy.
//   measureRT60(ir, sr, band)  Schroeder's backward integral, T20 x 3 - the gate's check on the IR.
//   craftTiers(...)            MSFS's AI tiers: <= 500 m full, <= 5 km the engine only, beyond silent; caps 2 + 8.
//   makeLoop(y, sr, s, xf)     a seamless loop: the last `s` seconds, its head cross-faded (equal power) into its tail.
// ============================================================
var SPACE_CONFIG = (function () {
  'use strict';
  const C0 = 343;   // m/s when the block has none
  // the octave centres the cabin's insulation is the mean over (the speech / engine-note band: MSFS's one number)
  const INSUL_F = [250, 500, 1000, 2000];
  // G1721 (SND-MIX) THE PROP'S TONE IN THE CABIN, dB under the rest of the group. In a direct drive the blade passage of a
  // two-blade prop IS the flat four's firing frequency (2 per rev), and the two voices are phase-locked by construction (one
  // shaft) at an angle each session draws by chance (the crank's seeded start, the prop node's start a block or more apart).
  // Summed in the cabin at like levels they cancel at bad angles: measured over 12 starting angles, full power and cruise,
  // the Jodel and the Cub, -10 to -13 dB under the power sum at two of them, -2 to -5 at three (tools/audio/mix_render.js;
  // reports/evidence/SND-MIX) - the laptop's "much too faint" engine can be a session's draw. A real cabin hears the two
  // through different paths (the cowl, the windshield, the structure) that never null; this keeps the tonal 10 dB under the
  // exhaust inside, which bounds the interference to +2.4 / -3.3 dB whatever the angle. Outside the directivity does it
  // (the tonal's lobe is not where the exhaust's is). The broadband part is noise: it never cancels, it is not trimmed.
  const CABIN_TONAL_DB = -10;

  // ---- THE CABIN BY CONSTRUCTION (ruling s5) --------------------------------------------------------------------
  // [insulation dB, high-shelf Hz, shelf dB, low-pass Hz, boom dB, boom Q, ambience duck dB]
  // open        no glazing / a door off: the engine almost exterior, the wind dominates (§4: 0-3 dB)
  // ultralight  6061 tube + Dacron pod: a sail between you and the engine
  // fabric      4130 tube + fabric (the Cub): ~6-12 dB, weak high-frequency loss - loud and bright
  // wood        a ply box under fabric (the Jodel): the fabric class's heavy end, a little boom
  // composite   a laminate shell: stiff and light - most of the metal's loss, less boom
  // metal       the alloy monocoque (the Cessna): ~15-25 dB, strong high-frequency loss, the boomy cabin mode
  const CABIN_CLASSES = {
    open:       { insul: 2,  shelfHz: 6000, shelfDb: -2,  lpHz: 18000, boomDb: 0, boomQ: 1.0, ambDb: 1 },
    ultralight: { insul: 5,  shelfHz: 3000, shelfDb: -4,  lpHz: 12000, boomDb: 0, boomQ: 1.0, ambDb: 4 },
    fabric:     { insul: 8,  shelfHz: 2500, shelfDb: -5,  lpHz: 10000, boomDb: 0, boomQ: 1.0, ambDb: 6 },
    wood:       { insul: 11, shelfHz: 2000, shelfDb: -7,  lpHz: 7000,  boomDb: 2, boomQ: 1.2, ambDb: 9 },
    composite:  { insul: 17, shelfHz: 1200, shelfDb: -10, lpHz: 4500,  boomDb: 4, boomQ: 1.2, ambDb: 14 },
    metal:      { insul: 20, shelfHz: 1000, shelfDb: -12, lpHz: 3200,  boomDb: 6, boomQ: 1.2, ambDb: 18 },
  };
  // the fuselage's material token (60_gen_spec.js GEN_MATERIALS; the surfaces' own tokens for an odd spec) -> class
  const MATERIAL_CLASS = { tubeFabric: 'fabric', steel: 'fabric', fabric: 'wood', wood: 'wood', aluTube: 'ultralight',
                           aluFabric: 'ultralight', alloy: 'metal', carbon: 'composite' };

  // ---- the Web Audio spec's BiquadFilterNode, magnitude only (RBJ cookbook, the spec's own formulas) -------------
  function biquadCoefs(type, f0, Q, gainDb, sr) {
    const w0 = 2 * Math.PI * f0 / sr, cw = Math.cos(w0), sw = Math.sin(w0);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass' || type === 'highpass' || type === 'bandpass') {
      // the spec: Q in dB for low/high-pass (alpha = sin w0 / (2 x 10^(Q/20))), linear for the band-pass
      const al = type === 'bandpass' ? sw / (2 * Q) : sw / (2 * Math.pow(10, Q / 20));
      if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
      else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
      else { b0 = al; b1 = 0; b2 = -al; }
      a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    } else if (type === 'peaking') {
      const al = sw / (2 * Q);
      b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
    } else {   // lowshelf / highshelf: the spec's S = 1 shelf (alpha = sin w0 / 2 x sqrt(2))
      const al = sw / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al;
      if (type === 'lowshelf') {
        b0 = A * ((A + 1) - (A - 1) * cw + sA); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sA);
        a0 = (A + 1) + (A - 1) * cw + sA; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sA;
      } else {
        b0 = A * ((A + 1) + (A - 1) * cw + sA); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sA);
        a0 = (A + 1) - (A - 1) * cw + sA; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sA;
      }
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  function biquadDb(type, f0, Q, gainDb, f, sr) {
    const k = biquadCoefs(type, f0, Q, gainDb, sr || 48000), w = 2 * Math.PI * f / (sr || 48000);
    const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = k.b0 + k.b1 * c1 + k.b2 * c2, ni = -(k.b1 * s1 + k.b2 * s2);
    const dr = 1 + k.a1 * c1 + k.a2 * c2, di = -(k.a1 * s1 + k.a2 * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  // a chain: { filters: [{type, f, Q, gain}], gainDb } -> dB at f
  function chainDb(ch, f, sr) {
    let db = ch.gainDb || 0;
    for (const q of ch.filters) db += biquadDb(q.type, q.f, q.Q, q.gain || 0, f, sr);
    return db;
  }
  const meanDb = (ch, F, sr) => { let s = 0; for (const f of F) s += chainDb(ch, f, sr); return s / F.length; };

  function cabinClassOf(spec) {
    const S = spec || {}, cab = S.cabin || {};
    const mat = S.material || (S.fuselage && S.fuselage.material) || null;
    if (cab.glazing === 'none') return { cls: 'open', material: mat, source: 'cabin.glazing none (an open cockpit)' };
    if (cab.doorOff || cab.doorsOff) return { cls: 'open', material: mat, source: 'the door is off' };
    const cls = MATERIAL_CLASS[mat];
    if (cls) return { cls, material: mat, source: 'fuselage ' + mat };
    return { cls: 'fabric', material: mat, source: 'fuselage ' + (mat || 'unknown') + ' (the fabric class: the common build)' };
  }
  const lerp = (a, b, u) => a + (b - a) * u;
  function cabinTransfer(spec, opt) {
    const o = opt || {}, K = cabinClassOf(spec);
    const T = CABIN_CLASSES[K.cls], O = CABIN_CLASSES.open;
    let ex = +o.exits || 0; ex = ex < 0 ? 0 : ex > 1 ? 1 : ex;
    const insul = lerp(T.insul, O.insul, ex);
    const shelfDb = lerp(T.shelfDb, O.shelfDb, ex), shelfHz = Math.exp(lerp(Math.log(T.shelfHz), Math.log(O.shelfHz), ex));
    const lpHz = Math.exp(lerp(Math.log(T.lpHz), Math.log(O.lpHz), ex));
    const boomDb = lerp(T.boomDb, O.boomDb, ex), ambDb = lerp(T.ambDb, O.ambDb, ex);
    // the boom: the cabin's first transverse mode, c / 2W, W its inside width (2 x cabin.halfW when the spec carries it)
    const S = spec || {}, cab = S.cabin || {};
    const W = cab.halfW > 0.2 ? 2 * cab.halfW : (/side|bench/.test(cab.seating || '') ? 1.1 : 0.8);
    let boomHz = C0 / (2 * W); boomHz = boomHz < 80 ? 80 : boomHz > 150 ? 150 : boomHz;
    const filters = [];
    if (boomDb > 0.05) filters.push({ type: 'peaking', f: boomHz, Q: T.boomQ, gain: boomDb });
    filters.push({ type: 'highshelf', f: shelfHz, Q: 0, gain: shelfDb });
    filters.push({ type: 'lowpass', f: lpHz, Q: -3.01, gain: 0 });   // Q in dB (the spec): -3.01 = Butterworth
    // the broadband gain, solved so the octave mean over INSUL_F is exactly -insul
    const ch = { filters, gainDb: 0 };
    ch.gainDb = -insul - meanDb(ch, INSUL_F);
    const hf = chainDb(ch, 4000) - chainDb(ch, 500);
    return { cls: K.cls, material: K.material, source: K.source, open: K.cls === 'open' ? 1 : 0, exits: ex,
             insulationDb: insul, hfLossDb: hf, boomHz: boomDb > 0.05 ? boomHz : 0, boomDb, lpHz, shelfHz, shelfDb,
             filters, gainDb: ch.gainDb, ambienceDb: ambDb, ambienceK: Math.pow(10, -ambDb / 20) };
  }

  // ---- THE HEADSET (ruling s7: offered, default off) ------------------------------------------------------------
  // passive: an earmuff's curve - ~13 dB at the low end rising toward ~23 dB above 4 kHz (the mass-spring cup), a mean
  // of ~15 dB over the band. ANR: the same cup plus a gentle low-shelf (-7 dB under ~300 Hz, the active part's band):
  // flatter, the drone of the engine goes first.
  function headsetCurve(kind) {
    if (!kind) return { filters: [{ type: 'highshelf', f: 1500, Q: 0, gain: 0 }, { type: 'lowshelf', f: 300, Q: 0, gain: 0 }], gainDb: 0 };
    return { filters: [{ type: 'highshelf', f: 1500, Q: 0, gain: -10 }, { type: 'lowshelf', f: 300, Q: 0, gain: kind === 'anr' ? -7 : 0 }], gainDb: -13 };
  }
  const headsetMeanDb = kind => meanDb(headsetCurve(kind), INSUL_F);
  const headsetK = kind => Math.pow(10, headsetMeanDb(kind) / 20);

  // ---- THE PROPAGATION ------------------------------------------------------------------------------------------
  // THE FRAME'S FORMS (G1680, SND-RADIO-2): each law below READS its arguments from a Float64Array and WRITES its
  // answer into the next slot - dopplerAt(F, i): F[i] c, F[i+1] vs, F[i+2] vl -> F[i+3]; absorbAt(F, i): F[i] d ->
  // F[i+1]; dirAt(kind, F, i): F[i] cosT -> F[i+1]; ringAtSlot(R, out): te in out[0]. A call that passes or returns a
  // double BOXES it (a fresh heap number) whenever the optimiser does not inline the call: on a Node without Maglev
  // space.js's moving frame grew the heap ~90-150 B a frame through dopplerFactor alone. A typed slot is never boxed,
  // so the frame does not depend on the inliner. The scalar forms (dopplerFactor, ...) are the same laws, for the
  // tools and the gate.
  const SCR = new Float64Array(8);
  function dopplerAt(F, i) {
    const c = F[i], vs = F[i + 1], vl = F[i + 2];
    const cc = c > 100 ? c : C0;
    let k = (cc - vl) / (cc - vs);
    F[i + 3] = k === k ? (k < 0.5 ? 0.5 : k > 2 ? 2 : k) : 1;
  }
  function dopplerFactor(c, vs, vl) { SCR[0] = c; SCR[1] = vs; SCR[2] = vl; dopplerAt(SCR, 0); return SCR[3]; }
  const ABS_K = 29e-3 / (4000 * 4000);   // dB / m / Hz^2 (29 dB/km at 4 kHz)
  function absorbAt(F, i) {
    const d = F[i], dd = d > 1 ? d : 1;
    const f = Math.sqrt(3 / (ABS_K * dd));
    F[i + 1] = f > 20000 ? 20000 : f < 250 ? 250 : f;
  }
  function airAbsorptionHz(d) { SCR[4] = d; absorbAt(SCR, 4); return SCR[5]; }
  // the radiation patterns
  const DIR_EXHAUST = 0, DIR_TONAL = 1, DIR_BROAD = 2, DIR_OMNI = 3;
  const TONAL_A = 0.6, TONAL_FLOOR = 0.03;
  // the tonal's normaliser: the maximum of sin^2 (1 - a cos) at cos = (2 - sqrt(4 + 12 a^2)) / 6a
  const TONAL_CMAX = (2 - Math.sqrt(4 + 12 * TONAL_A * TONAL_A)) / (6 * TONAL_A);
  const TONAL_NORM = (1 - TONAL_CMAX * TONAL_CMAX) * (1 - TONAL_A * TONAL_CMAX);
  function dirAt(kind, F, i) {
    const cosT = F[i], c = cosT > 1 ? 1 : cosT < -1 ? -1 : cosT, s2 = 1 - c * c;
    if (kind === DIR_EXHAUST) { F[i + 1] = 0.55 + 0.45 * (1 - c) * 0.5; return; }
    if (kind === DIR_TONAL) { const g = s2 * (1 - TONAL_A * c) / TONAL_NORM; F[i + 1] = g > TONAL_FLOOR ? g : TONAL_FLOOR; return; }
    if (kind === DIR_BROAD) { F[i + 1] = 0.5 + 0.5 * s2; return; }
    F[i + 1] = 1;
  }
  function directivity(kind, cosT) { SCR[6] = cosT; dirAt(kind, SCR, 6); return SCR[7]; }
  // THE RING of an emitter's past: R = { a: Float64Array(cap * 7) [t x y z vx vy vz], cap, n (filled), head (newest) }
  const RW = 7;
  function ringMake(cap) { return { a: new Float64Array(cap * RW), cap, n: new Int32Array(2) }; }   // n[0] count, n[1] head
  // push (t, x, y, z) from a Float64Array `p` [t, x, y, z]; the velocity is the smoothed difference (tau ~0.15 s)
  function ringPush(R, p) {
    const a = R.a, cap = R.cap, n = R.n;
    const h = n[0] > 0 ? n[1] : -1, o = ((h + 1) % cap) * RW;
    if (h >= 0) {
      const q = h * RW, dt = p[0] - a[q];
      if (dt <= 1e-6) {   // the same instant again: overwrite the head
        a[q + 1] = p[1]; a[q + 2] = p[2]; a[q + 3] = p[3]; return;
      }
      const k = dt / (dt + 0.15);
      a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2]; a[o + 3] = p[3];
      a[o + 4] = a[q + 4] + ((p[1] - a[q + 1]) / dt - a[q + 4]) * k;
      a[o + 5] = a[q + 5] + ((p[2] - a[q + 2]) / dt - a[q + 5]) * k;
      a[o + 6] = a[q + 6] + ((p[3] - a[q + 3]) / dt - a[q + 6]) * k;
    } else { a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2]; a[o + 3] = p[3]; a[o + 4] = a[o + 5] = a[o + 6] = 0; }
    n[1] = h < 0 ? 0 : (h + 1) % cap;
    if (n[0] < cap) n[0]++;
  }
  // a jump (a respawn, a camera cut does not matter here - only the emitter's own teleport): forget the past
  function ringReset(R) { R.n[0] = 0; R.n[1] = 0; }
  // the state at time te, linearly interpolated (binary search over the ring's monotonic times) -> out[1..6]
  // (ringAtSlot: te read from out[0] - the frame's form)
  function ringAt(R, te, out) { out[0] = te; ringAtSlot(R, out); }
  function ringAtSlot(R, out) {
    const te = out[0], a = R.a, cap = R.cap, cnt = R.n[0], h = R.n[1];
    if (cnt === 0) { out[1] = out[2] = out[3] = out[4] = out[5] = out[6] = 0; return; }
    const old = (h - cnt + 1 + cap) % cap;
    let lo = 0, hi = cnt - 1;   // logical indices, 0 = oldest (no closure for the lookup: the frame allocates nothing)
    if (te <= a[old * RW]) { const q = old * RW; for (let k = 1; k < RW; k++) out[k] = a[q + k]; return; }
    if (te >= a[h * RW]) { const q = h * RW; for (let k = 1; k < RW; k++) out[k] = a[q + k]; return; }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[((old + m) % cap) * RW] <= te) lo = m; else hi = m; }
    const q0 = ((old + lo) % cap) * RW, q1 = ((old + hi) % cap) * RW;
    const u = (te - a[q0]) / (a[q1] - a[q0] || 1);
    for (let k = 1; k < RW; k++) out[k] = a[q0 + k] + (a[q1 + k] - a[q0 + k]) * u;
  }
  // at: Float64Array [t, Lx, Ly, Lz, c]; out: Float64Array(8) [tau, x, y, z, vx, vy, vz, dist]
  function retardedSolve(R, at, out) {
    const t = at[0], Lx = at[1], Ly = at[2], Lz = at[3], c = at[4] > 100 ? at[4] : C0;
    let tau = 0;
    for (let it = 0; it < 6; it++) {
      out[0] = t - tau; ringAtSlot(R, out);   // (te in the slot: a double argument would box)
      const dx = out[1] - Lx, dy = out[2] - Ly, dz = out[3] - Lz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz), nt = d / c;
      out[7] = d;
      if (Math.abs(nt - tau) < 1e-6) { tau = nt; break; }
      tau = nt;
    }
    out[0] = tau;
  }

  // ---- THE VIEWPOINT'S CROSS-FADE (MSFS: 150 ms, equal power) -----------------------------------------------------
  const XFADE_S = 0.15;
  // dst Float32Array: the interior share from x0 to x1 as sin(pi/2 x) (inverse: the exterior's cos) - endpoints exact
  function xfadeCurve(dst, x0, x1, exterior) {
    const n = dst.length;
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * i / (n - 1);
      dst[i] = exterior ? Math.cos(Math.PI / 2 * x) : Math.sin(Math.PI / 2 * x);
    }
    const end = exterior ? (x1 >= 1 ? 0 : x1 <= 0 ? 1 : dst[n - 1]) : (x1 >= 1 ? 1 : x1 <= 0 ? 0 : dst[n - 1]);
    dst[n - 1] = end;
    if (x0 <= 0) dst[0] = exterior ? 1 : 0; else if (x0 >= 1) dst[0] = exterior ? 0 : 1;
    return dst;
  }

  // ---- THE SHED'S ROOM ------------------------------------------------------------------------------------------
  const OCT = [125, 250, 500, 1000, 2000, 4000];
  // absorption coefficients per octave (Kuttruff / Long's tables, typical values)
  const ALPHA = {
    concrete: [0.01, 0.01, 0.015, 0.02, 0.02, 0.02],
    steelSheet: [0.15, 0.10, 0.07, 0.05, 0.04, 0.04],     // thin cladding: its panels' resonance takes the low end
    brick: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07],
    timber: [0.15, 0.11, 0.10, 0.07, 0.06, 0.07],
    glazing: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04],
    contents: [0.04, 0.05, 0.06, 0.07, 0.07, 0.07],       // the aeroplane, the benches, the racks: per m2 of floor
    open: [1, 1, 1, 1, 1, 1],
  };
  // the air's 4m (1/m) per octave, 20 C ~50-70 % RH (ISO 9613-1: 0.4 / 1.1 / 2.7 / 4.7 / 9.9 / 29 dB/km)
  const AIR_4M = [0.4, 1.1, 2.7, 4.7, 9.9, 29].map(dbkm => 4 * dbkm / (1000 * 10 * Math.LOG10E));
  // the shells (26_hangar_fit.js SHELLS; hangar.js's frame family): walls, roof, the north glazing band (portal only)
  const SHELL_MAT = {
    club:  { walls: 'steelSheet', roof: 'steelSheet', glazing: 1 },
    works: { walls: 'brick', roof: 'steelSheet', glazing: 1 },
    field: { walls: 'timber', roof: 'steelSheet', glazing: 0 },
  };
  function hangarAcoustics(dims, shell, opt) {
    const o = opt || {}, D = dims || {};
    const HW = D.HW || 15, HD = D.HD || 12.5, EAVE = D.EAVE || 7.0, RIDGE = D.RIDGE || EAVE + 2.6;
    const key = SHELL_MAT[shell] ? shell : 'club', M = SHELL_MAT[key], timber = key === 'field';
    // hangar.js's door: nearly the whole gable (the timber shed's to its eave)
    const doorW = Math.max(6, 2 * HW - 5), doorH = timber ? EAVE - 0.5 : Math.min(6.4, EAVE - 1.4);
    const doorOpen = o.doorOpen == null ? 1 : +o.doorOpen;
    const W = 2 * HW, L = 2 * HD, rise = RIDGE - EAVE;
    const V = W * L * (EAVE + rise / 2);
    const floor = W * L, roof = L * 2 * Math.sqrt(HW * HW + rise * rise);
    const longWalls = 2 * L * EAVE, gables = 2 * (W * EAVE + HW * rise);
    const glazingA = M.glazing ? Math.min(0.15 * longWalls, 2 * L * 1.2) : 0;   // the north band, ~1.2 m high
    const doorA = doorW * doorH * doorOpen;
    const wallA = longWalls + gables - glazingA - doorA;
    const A = new Array(6), rt = new Array(6);
    for (let b = 0; b < 6; b++) {
      A[b] = floor * ALPHA.concrete[b] + roof * ALPHA[M.roof][b] + wallA * ALPHA[M.walls][b] + glazingA * ALPHA.glazing[b]
           + doorA * ALPHA.open[b] + floor * ALPHA.contents[b];
      rt[b] = 0.161 * V / (A[b] + AIR_4M[b] * V);
    }
    return { shell: key, HW, HD, EAVE, RIDGE, V, S: floor + roof + longWalls + gables, doorA, A, rt60: rt, bands: OCT,
             rt60Mid: (rt[2] + rt[3]) / 2, preDelayS: Math.min(HW, HD, EAVE) / C0 };
  }
  // the IR: per octave, a noise band (2nd-order band-pass, Q ~1.4) under exp(-6.91 t / RT60_b), the bands summed, two
  // independent noises for L and R (decorrelated), a pre-delay of the nearest surface's path, unit energy per channel.
  // Seeded (xorshift32): the same shed, the same IR. Capped at maxS (the convolver's cost grows with it).
  function hangarIR(room, sr, opt) {
    const o = opt || {}, fs = sr || 48000;
    const rtMax = Math.max.apply(null, room.rt60);
    const len = Math.max(1, Math.round(Math.min(o.maxS || 4.5, 1.2 * rtMax + room.preDelayS) * fs));
    const pre = Math.round(room.preDelayS * fs);
    const out = [new Float32Array(len), new Float32Array(len)];
    let s = (o.seed >>> 0) || 0x2f6e2b1;
    for (let ch = 0; ch < 2; ch++) {
      const y = out[ch];
      for (let b = 0; b < OCT.length; b++) {
        const k = biquadCoefs('bandpass', OCT[b], 1.41, 0, fs);
        const dec = Math.exp(-6.907755 / (room.rt60[b] * fs));
        // a band's noise has 1/Q of white's power; the bands overlap ~ equally, so weight each to unit power
        const wgt = Math.sqrt(1.41 * 3);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0, env = 1;
        for (let i = 0; i < len; i++) {
          s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
          const x = (s | 0) * 4.656612873077393e-10;
          const v = k.b0 * x + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2;
          x2 = x1; x1 = x; y2 = y1; y1 = v;
          if (i >= pre) { y[i] += wgt * v * env; env *= dec; }
        }
      }
      // a 2 ms fade-in after the pre-delay (no click on the direct onset), then unit energy
      const fi = Math.round(0.002 * fs);
      for (let i = 0; i < fi && pre + i < len; i++) y[pre + i] *= i / fi;
      let e = 0; for (let i = 0; i < len; i++) e += y[i] * y[i];
      const g = e > 0 ? 1 / Math.sqrt(e) : 0;
      for (let i = 0; i < len; i++) y[i] *= g;
    }
    return { L: out[0], R: out[1], sr: fs, length: len, rt60: room.rt60.slice(), rt60Mid: room.rt60Mid };
  }
  // Schroeder: the backward-integrated energy of the IR (band-filtered when `band` Hz is given), the slope between
  // -5 and -25 dB (T20) x 3 -> RT60 s
  function measureRT60(ir, sr, band) {
    let y = ir;
    if (band) {
      const k = biquadCoefs('bandpass', band, 1.41, 0, sr);
      y = new Float64Array(ir.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < ir.length; i++) { const x = ir[i], v = k.b0 * x + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = v; y[i] = v; }
    }
    const n = y.length, E = new Float64Array(n);
    let acc = 0;
    for (let i = n - 1; i >= 0; i--) { acc += y[i] * y[i]; E[i] = acc; }
    const e0 = E[0] || 1;
    let i5 = -1, i25 = -1;
    for (let i = 0; i < n; i++) {
      const db = 10 * Math.log10(E[i] / e0 + 1e-30);
      if (i5 < 0 && db <= -5) i5 = i;
      if (db <= -25) { i25 = i; break; }
    }
    if (i5 < 0 || i25 < 0) return NaN;
    // least squares over the -5..-25 dB stretch
    let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0;
    for (let i = i5; i <= i25; i++) { const x = i / sr, v = 10 * Math.log10(E[i] / e0 + 1e-30); sx += x; sy += v; sxx += x * x; sxy += x * v; m++; }
    const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
    return slope < 0 ? -60 / slope : NaN;
  }

  // ---- OTHER AIRCRAFT: the tiers ---------------------------------------------------------------------------------
  const TIER_FULL_M = 500, TIER_ENGINE_M = 5000, CAP_FULL = 2, CAP_BAKED = 8;
  const TIER_SILENT = 0, TIER_ENGINE = 1, TIER_FULL = 2;
  // dist: Float64Array of distances (n crafts), order: Int32Array scratch (n), tier: Uint8Array out (n). The nearest
  // within 500 m take the full tier (up to capFull), then everything within 5 km takes the engine-only tier until the
  // baked cap (capBaked voices in all: full voices count) is spent; the rest is silent. Allocation-free.
  function craftTiers(dist, n, order, tier, capFull, capBaked) {
    const cf = capFull == null ? CAP_FULL : capFull, cb = capBaked == null ? CAP_BAKED : capBaked;
    for (let i = 0; i < n; i++) { order[i] = i; tier[i] = TIER_SILENT; }
    for (let i = 1; i < n; i++) {   // insertion sort by distance (n <= a few dozen)
      const k = order[i]; let j = i - 1;
      while (j >= 0 && dist[order[j]] > dist[k]) { order[j + 1] = order[j]; j--; }
      order[j + 1] = k;
    }
    let full = 0, used = 0;
    for (let r = 0; r < n; r++) {
      const i = order[r], d = dist[i];
      if (!(d <= TIER_ENGINE_M) || used >= cb + cf) break;
      if (d <= TIER_FULL_M && full < cf) { tier[i] = TIER_FULL; full++; used++; }
      else if (used - full < cb) { tier[i] = TIER_ENGINE; used++; }
    }
    return full;
  }
  // the rpm points a craft's loops are baked at: idle .. rated, `n` of them, denser at the top (cruise lives there)
  function bakePoints(idleRpm, ratedRpm, n) {
    const k = n || 5, out = [];
    for (let i = 0; i < k; i++) { const u = i / (k - 1); out.push(idleRpm + (ratedRpm - idleRpm) * Math.sqrt(u)); }
    return out;
  }
  // which two points bracket rpm, and the equal-power weight of the upper one; out Float64Array [i0, i1, w1, rate0, rate1]
  function loopBlend(points, rpm, out) { out[0] = rpm; loopBlendSlot(points, out); }
  function loopBlendSlot(points, out) {   // (the frame's form: the rpm read from out[0])
    const rpm = out[0], n = points.length;
    let i0 = 0;
    while (i0 < n - 2 && rpm > points[i0 + 1]) i0++;
    const i1 = n > 1 ? i0 + 1 : 0, a = points[i0], b = points[i1];
    let u = b > a ? (rpm - a) / (b - a) : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    out[0] = i0; out[1] = i1; out[2] = u;
    out[3] = a > 0 ? rpm / a : 1; out[4] = b > 0 ? rpm / b : 1;
  }
  // a loop: the last `seconds` of y, whose first `xf` seconds are cross-faded (equal power) over the tail they follow
  function makeLoop(y, sr, seconds, xf) {
    const n = Math.min(y.length, Math.round(seconds * sr)), f = Math.min(Math.round((xf || 0.15) * sr), n >> 2);
    const start = y.length - n, out = new Float32Array(n - f);
    // out = y[start + f .. end), with its last f samples blended into the f samples that preceded the loop's start
    for (let i = 0; i < n - f; i++) out[i] = y[start + f + i];
    for (let i = 0; i < f; i++) {
      const u = (i + 0.5) / f, gi = Math.sin(Math.PI / 2 * u), go = Math.cos(Math.PI / 2 * u);
      const j = n - 2 * f + i;   // the tail's last f samples
      out[j] = y[start + f + j] * go + y[start + i] * gi;
    }
    return out;
  }

  return { CABIN_CLASSES, MATERIAL_CLASS, INSUL_F, CABIN_TONAL_DB, cabinClassOf, cabinTransfer, biquadCoefs, biquadDb, chainDb, meanDb,
           headsetCurve, headsetMeanDb, headsetK, dopplerFactor, airAbsorptionHz, directivity, dopplerAt, absorbAt, dirAt, ringAtSlot,
           DIR_EXHAUST, DIR_TONAL, DIR_BROAD, DIR_OMNI, TONAL_A, TONAL_FLOOR, RW, ringMake, ringPush, ringReset, ringAt,
           retardedSolve, XFADE_S, xfadeCurve, OCT, ALPHA, AIR_4M, SHELL_MAT, hangarAcoustics, hangarIR, measureRT60,
           TIER_FULL_M, TIER_ENGINE_M, CAP_FULL, CAP_BAKED, TIER_SILENT, TIER_ENGINE, TIER_FULL, craftTiers, bakePoints,
           loopBlend, loopBlendSlot, makeLoop, C0 };
})();
if (typeof window !== 'undefined') window.SPACE_CONFIG = SPACE_CONFIG;
if (typeof module !== 'undefined' && module.exports) module.exports = SPACE_CONFIG;
