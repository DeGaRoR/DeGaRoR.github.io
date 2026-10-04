// ============================================================
// THE AIRFRAME VOICE (G1631, SND-AIRFRAME; SOUND-2026-10-04 §3.5 / §4).
// One AudioWorkletProcessor, registerProcessor('flydiy-airframe'): the wind,
// the ground roll by surface, the tailwheel rattle, the brakes, the water,
// the stall warning, the creaks and the flap motor - all synthesised, no
// sample needed (recorded grains BLEND IN on the main thread, samples.js; the
// `duck` param lowers the procedural layer a sample is covering) - and a pool
// of one-shot voices for the events (touchdown, chirp, thump, splash, lever).
//
// INPUTS   none. The k-rate params below are the targets airframe_model.js
//          computes per frame (src_airframe.js schedules them, tau 30 ms); the
//          events arrive by port message {t: 'ev', e, s, a, b, k}
//          (e: 1 touchdown, 2 chirp, 3 thump, 4 splash, 5 lever; s severity
//          0..1; a the wheel; b the GROUND_SURF row; k 1 = a recorded one-shot
//          plays beside it, the procedural one at 35 %), {t: 'reset'}.
// OUTPUTS  0  EXTERIOR mono: the wind the camera hears (gentle), the ground,
//             the water, the events' outside sound.
//          1  INTERIOR mono: the cabin's wind (a closed cabin's muffled hiss,
//             an open cockpit's blast), the ground through the structure, a
//             placeholder cabin low-pass on the airborne part (SND-SPACE owns
//             the real cabin transfer), and the INTERIOR-ONLY layers: the
//             stall warning, the creaks and rattles, the flap motor, the lever.
// The surface rows (GROUND_SURF, 00_registry.js): 0 grass 1 rock 2 scree
// 3 forest floor 4 water 5 paved 6 gravel 7 sand. Synthesis per row: a low
// rumble (two one-poles of white noise, bump-modulated), a band of hiss, a
// shot-noise CRUNCH (Poisson grains at a rate ~ ground speed, one decaying
// envelope on white noise through a band-pass: gravel's crunch, grass's soft
// brush), a tyre-tread hum on paved (a narrow band at ground speed / 3 cm).
//
// THE DUCK (param `duck`, bits): 1 ground, 2 water, 4 wind, 8 creaks, 16 stall - a recorded loop / grain is covering
// that layer (src_airframe.js sets it when the key resolves), and the procedural one plays at 30 % under it.
//
// ALLOCATION-FREE process(): every state is a slot of one Float64Array, the
// filters (Simper's TPT state-variable filter) are written inline, the PRNG
// is a local int; a layer whose level is 0 on both ends of the block is not
// computed at all (the shed and a parked aeroplane cost a block fill). The
// coefficient helpers take an INT (the slot) and read their doubles from the
// array - a double argument to a call V8 does not inline is a fresh box
// (SND-ENGINE's finding). A +-1e-18 bias keeps the filter states out of the
// subnormals; a NaN resets the voice.
// ============================================================
'use strict';

const AF_PARAM_NAMES = ['windL', 'windF', 'windT', 'windI', 'gndL', 'gndS', 'gndV', 'tailR', 'brk',
                        'watL', 'watV', 'watStep', 'watSlap', 'watDrag', 'stall', 'stallK', 'creak', 'flapM', 'open', 'duck'];
const AF_DENORMAL = 1e-18;
// the surface table: per GROUND_SURF row [rumble, hiss, hissHz, hissQ, grains per s per m/s, grainHz, grain decay ms, tread hum]
const AF_SURF = [
  [0.50, 0.90, 2600, 0.7, 3, 1500, 12, 0],      // 0 grass: the brush of the blades, a soft thud
  [1.00, 0.25, 1400, 0.8, 5, 2200, 6, 0.1],     // 1 rock: hard bumps
  [0.95, 0.30, 1500, 0.8, 12, 1900, 9, 0],      // 2 scree: loose stone sliding, heavier and duller grains
  [0.70, 0.45, 900, 0.7, 5, 900, 14, 0],        // 3 forest floor: dull, soft
  [0.00, 0.00, 1000, 0.7, 0, 1000, 10, 0],      // 4 water: the drag layer's, not the roll's
  [0.35, 0.45, 650, 1.0, 0, 2000, 5, 0.6],      // 5 paved: the tyre roar and the tread hum
  [0.65, 0.20, 3200, 0.8, 28, 3500, 4, 0],      // 6 gravel: the crunch
  [0.50, 0.80, 1300, 0.5, 8, 1200, 10, 0],      // 7 sand: a hiss, soft grains
];
const AF_SURF_W = 8;
// the events, and the one-shot voices' kinds
const AF_E_TD = 1, AF_E_CHIRP = 2, AF_E_THUMP = 3, AF_E_SPLASH = 4, AF_E_LEVER = 5;
const VK_LOW = 1, VK_BAND = 2, VK_CHIRP = 3, VK_RING = 4;
const NV = 8;

// ---- THE STATE: one Float64Array, named offsets -------------------------------------------------------------
// an SVF takes 8 slots: ic1 ic2 a1 a2 a3 k fc Q
let _o = 0;
const svfAt = () => { const o = _o; _o += 8; return o; };
const F_WIND = svfAt(), F_HISS = svfAt(), F_TONE = svfAt(), F_CRUNCH = svfAt(), F_RATTLE = svfAt(), F_SPRAY = svfAt(),
      F_SLAP = svfAt(), F_BUB = svfAt(), F_BREATH = svfAt(), F_CRK1 = svfAt(), F_CRK2 = svfAt(), F_TICK = svfAt();
const F_VOICE = _o; _o += 8 * NV;
// scalars
const sl = () => _o++;
const Z_GUST = sl(), Z_BUFF = sl(), Z_BUMP = sl(), Z_WANDER = sl(), Z_DRAGM = sl(),   // one-pole noise LFOs
      Z_R1 = sl(), Z_R2 = sl(), Z_CAB = sl(), Z_CABW = sl(), Z_DRAG1 = sl(), Z_DRAG2 = sl(), Z_MOTLP = sl(), Z_BUZLP = sl(),
      Z_DCX0 = sl(), Z_DCY0 = sl(), Z_DCX1 = sl(), Z_DCY1 = sl(),
      Z_EG = sl(), Z_ER = sl(), Z_ES = sl(), Z_EB = sl(), Z_ET = sl(),                  // shot-noise envelopes
      Z_PHB = sl(), Z_PHS = sl(), Z_PHM = sl(), Z_PHV = sl(),                           // phases: brake, stall, motor, vibrato
      Z_BURST = sl(), Z_BRATE = sl(), Z_BAMP = sl(), Z_T = sl(),
      Z_DENS = sl();
// the surface weights now (smoothed toward the row's), and the previous block's levels
const Z_SW = _o; _o += AF_SURF_W;
const Z_PREV = _o; _o += AF_PARAM_NAMES.length;
const Z_LEN = _o;
// the voices: kind, ext gain, int gain, amp, decay per sample, env, age, delay, f0, f1, dur, phase
const VW = 12;

class FlyDiyAirframeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    const maxOf = { windF: 6000, gndS: 7, gndV: 100, watV: 100, stallK: 2, duck: 31 };
    return AF_PARAM_NAMES.map(name => ({ name, defaultValue: name === 'windF' ? 250 : 0, minValue: 0,
      maxValue: maxOf[name] != null ? maxOf[name] : 4, automationRate: 'k-rate' }));
  }

  constructor (options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.sr = sampleRate;
    this.z = new Float64Array(Z_LEN);
    this.v = new Float64Array(NV * VW);
    this.rs = new Uint32Array(1);
    this.rs[0] = (po.seed >>> 0) || 0x9e3779b9;
    // counters for the gate and the dev panel: events taken, NaN resets, samples guarded at the ceiling, blocks computed
    this.stats = new Float64Array(4);
    const z = this.z;
    z[Z_SW] = 1;                                // grass until told
    for (let k = 1; k < AF_SURF_W; k++) z[Z_SW + k] = AF_SURF[0][k];
    z[Z_PREV + 1] = 250;
    z[Z_DENS] = AF_DENORMAL;
    if (this.port) this.port.onmessage = (e) => this.message(e.data);
  }

  message (d) {
    if (!d) return;
    if (d.t === 'reset') { this.v.fill(0); return; }
    if (d.t === 'ev') this.event(d.e | 0, +d.s || 0, d.a | 0, d.b | 0, d.k ? 0.35 : 1);
  }

  // a voice from the pool: the first free one, else the oldest. kind, gains, amp, decay tau (s), f0, f1, dur (s), delay (s)
  voice (kind, ge, gi, amp, tau, f0, f1, dur, del, q) {
    const v = this.v, sr = this.sr;
    let best = 0, age = -1;
    for (let i = 0; i < NV; i++) {
      if (v[i * VW] === 0) { best = i; age = -2; break; }
      if (v[i * VW + 6] > age) { age = v[i * VW + 6]; best = i; }
    }
    const o = best * VW;
    v[o] = kind; v[o + 1] = ge; v[o + 2] = gi; v[o + 3] = amp; v[o + 4] = Math.exp(-1 / Math.max(1, tau * sr));
    v[o + 5] = kind === VK_CHIRP ? 0 : 1; v[o + 6] = 0; v[o + 7] = Math.round(del * sr);
    v[o + 8] = f0; v[o + 9] = f1; v[o + 10] = Math.max(1, Math.round(dur * sr)); v[o + 11] = 0;
    const f = F_VOICE + best * 8, z = this.z;
    z[f] = z[f + 1] = 0; z[f + 6] = f0; z[f + 7] = q;
    this.coef(f);
  }
  event (e, s, a, b, k) {
    this.stats[0]++;
    const surfHz = b === 5 ? 1500 : b === 6 || b === 2 ? 3000 : b === 0 ? 2500 : 1800;
    if (e === AF_E_TD) {
      this.voice(VK_LOW, 1, 1.1, k * (0.08 + 0.35 * s), 0.05 + 0.09 * s, 90 + 150 * s, 0, 1, 0, 0.9);
      this.voice(VK_BAND, 1, 0.3, k * (0.05 + 0.15 * s), 0.02 + 0.03 * s, surfHz, 0, 1, 0, 0.7);
    } else if (e === AF_E_CHIRP) {
      this.voice(VK_CHIRP, 1, 0.35, k * (0.06 + 0.14 * s), 0.03, 2300, 1500, 0.07 + 0.13 * s, 0, 2);
    } else if (e === AF_E_THUMP) {
      this.voice(VK_LOW, 0.5, 1.2, k * (0.1 + 0.3 * s), 0.09, 55 + 30 * s, 0, 1, 0, 0.9);
      this.voice(VK_RING, 0.3, 1, k * (0.03 + 0.08 * s), 0.05, 650, 0, 0.004, 0, 8);
    } else if (e === AF_E_SPLASH) {
      this.voice(VK_BAND, 1, 0.5, k * (0.1 + 0.25 * s), 0.18 + 0.3 * s, 900, 0, 1, 0, 0.4);
      this.voice(VK_LOW, 1, 0.8, k * (0.08 + 0.2 * s), 0.12, 140, 0, 1, 0, 0.9);
    } else if (e === AF_E_LEVER) {
      this.voice(VK_BAND, 0.1, 1, k * 0.08, 0.006, 2500, 0, 1, 0, 1.5);
      this.voice(VK_RING, 0.1, 1, k * 0.1, 0.04, 320, 0, 0.003, 0.03, 4);
    }
  }

  // the TPT SVF's coefficients from its own fc / Q slots (an int argument: nothing boxed)
  coef (o) {
    const z = this.z, fc = Math.min(Math.max(z[o + 6], 10), 0.45 * this.sr);
    const g = Math.tan(Math.PI * fc / this.sr), k = 1 / Math.max(0.1, z[o + 7]);
    const a1 = 1 / (1 + g * (g + k));
    z[o + 2] = a1; z[o + 3] = g * a1; z[o + 4] = g * g * a1; z[o + 5] = k;
  }

  process (inputs, outputs, params) {
    const oE = outputs[0] && outputs[0][0], oI = outputs[1] && outputs[1][0];
    if (!oE) return true;
    const n = oE.length, z = this.z, v = this.v, sr = this.sr, P = Z_PREV;
    // the targets now (k-rate) and at the block's start (the previous block's)
    const windL = params.windL[0], windF = params.windF[0], windT = params.windT[0], windI = params.windI[0];
    const gndL = params.gndL[0], gndS = params.gndS[0], gndV = params.gndV[0], tailR = params.tailR[0], brk = params.brk[0];
    const watL = params.watL[0], watV = params.watV[0], watStep = params.watStep[0], watSlap = params.watSlap[0];
    const watDrag = params.watDrag[0], stall = params.stall[0], stallK = params.stallK[0], creak = params.creak[0];
    const flapM = params.flapM[0], open = params.open[0], duck = params.duck[0] | 0;
    const pWindL = z[P], pWindI = z[P + 3], pGndL = z[P + 4], pTailR = z[P + 7], pBrk = z[P + 8], pWatL = z[P + 9];
    const pWatSlap = z[P + 12], pWatDrag = z[P + 13], pStall = z[P + 14], pCreak = z[P + 16], pFlapM = z[P + 17], pOpen = z[P + 18];
    // the duck: a recorded loop covers the layer (bits: 1 ground, 2 water, 4 wind, 8 creaks, 16 stall); the procedural keeps 30 %
    const dG = duck & 1 ? 0.3 : 1, dW = duck & 2 ? 0.3 : 1, dA = duck & 4 ? 0.3 : 1, dC = duck & 8 ? 0.3 : 1, dS = duck & 16 ? 0.3 : 1;
    const doWind = windL > 0 || pWindL > 0 || windI > 0 || pWindI > 0;
    const doGnd = gndL > 0 || pGndL > 0, doRat = tailR > 0 || pTailR > 0, doBrk = brk > 0 || pBrk > 0;
    const doSpray = watL > 0 || pWatL > 0, doSlap = watSlap > 0 || pWatSlap > 0, doDrag = watDrag > 0 || pWatDrag > 0;
    const doStall = stallK > 0 && (stall > 0 || pStall > 0), doCreak = creak > 0 || pCreak > 0, doMot = flapM > 0 || pFlapM > 0;
    let voices = 0;
    for (let i = 0; i < NV; i++) if (v[i * VW] !== 0) voices++;
    if (!doWind && !doGnd && !doRat && !doBrk && !doSpray && !doSlap && !doDrag && !doStall && !doCreak && !doMot && voices === 0
        && Math.abs(z[Z_DCY0]) < 1e-6 && Math.abs(z[Z_DCY1]) < 1e-6) {
      oE.fill(0); if (oI) oI.fill(0);
      this.keep(params); return true;
    }
    this.stats[3]++;
    const blk = n / sr, inv = 1 / n;
    // ---- per-block: the surface weights toward the row, the filters' coefficients ----
    const row = gndS >= 0 && gndS < 8 ? gndS | 0 : 0;
    const ks = 1 - Math.exp(-blk / 0.15);
    for (let k = 0; k < AF_SURF_W; k++) z[Z_SW + k] += (AF_SURF[row][k] - z[Z_SW + k]) * ks;
    const wR = z[Z_SW], wH = z[Z_SW + 1], hissHz = z[Z_SW + 2], hissQ = z[Z_SW + 3], gK = z[Z_SW + 4], gHz = z[Z_SW + 5];
    const gDec = Math.exp(-1 / (z[Z_SW + 6] * 0.001 * sr)), wT = z[Z_SW + 7];
    if (doWind) { z[F_WIND + 6] = windF; z[F_WIND + 7] = 0.6; this.coef(F_WIND); }
    if (doGnd) {
      z[F_HISS + 6] = hissHz * (0.8 + 0.015 * gndV); z[F_HISS + 7] = hissQ; this.coef(F_HISS);
      z[F_TONE + 6] = Math.min(1800, Math.max(40, gndV / 0.03)); z[F_TONE + 7] = 8; this.coef(F_TONE);
      z[F_CRUNCH + 6] = gHz; z[F_CRUNCH + 7] = 1.1; this.coef(F_CRUNCH);
    }
    if (doRat) { z[F_RATTLE + 6] = 1900; z[F_RATTLE + 7] = 5; this.coef(F_RATTLE); }
    if (doSpray) { z[F_SPRAY + 6] = 1800 + 90 * watV; z[F_SPRAY + 7] = 0.5; this.coef(F_SPRAY); }
    if (doSlap) { z[F_SLAP + 6] = 180 + 20 * watV; z[F_SLAP + 7] = 0.8; this.coef(F_SLAP); }
    if (doDrag) { z[F_BUB + 6] = 650; z[F_BUB + 7] = 3; this.coef(F_BUB); }
    if (doStall) { z[F_BREATH + 6] = 1400; z[F_BREATH + 7] = 1; this.coef(F_BREATH); }
    if (doCreak) { z[F_CRK1 + 6] = 520; z[F_CRK1 + 7] = 12; this.coef(F_CRK1); z[F_CRK2 + 6] = 1350; z[F_CRK2 + 7] = 10; this.coef(F_CRK2); z[F_TICK + 6] = 3200; z[F_TICK + 7] = 4; this.coef(F_TICK); }
    // the one-pole LFOs' coefficients and their normalisers (a one-pole of white noise has variance c/(2-c))
    const cGust = 1 - Math.exp(-2 * Math.PI * 0.7 / sr), nGust = 1 / Math.sqrt(cGust / (2 - cGust) / 3);
    const cBuff = 1 - Math.exp(-2 * Math.PI * 9 / sr), nBuff = 1 / Math.sqrt(cBuff / (2 - cBuff) / 3);
    const cBump = 1 - Math.exp(-2 * Math.PI * 3 / sr), nBump = 1 / Math.sqrt(cBump / (2 - cBump) / 3);
    const cWan = 1 - Math.exp(-2 * Math.PI * 2 / sr), nWan = 1 / Math.sqrt(cWan / (2 - cWan) / 3);
    const cRum = 1 - Math.exp(-2 * Math.PI * (30 + 3 * gndV) / sr);
    const nRum = 1 / Math.sqrt(cRum / 12);   // two cascaded one-poles of uniform white: variance ~ c/4 x 1/3
    const cCab = 1 - Math.exp(-2 * Math.PI * 900 / sr), cCabW = 1 - Math.exp(-2 * Math.PI * 380 / sr);
    const cDrag = 1 - Math.exp(-2 * Math.PI * 260 / sr), cMot = 1 - Math.exp(-2 * Math.PI * 1800 / sr);
    const cBuz = 1 - Math.exp(-2 * Math.PI * 3000 / sr);
    const nDrag = 1 / Math.sqrt(cDrag / 12);
    const dcR = 1 - 2 * Math.PI * 20 / sr;
    // the event rates (per sample)
    const pGrain = Math.min(900, gK * gndV) / sr, pRat = (3 + 2.5 * gndV) / sr;
    const pSlap = ((1 - watStep) * (0.7 + 0.2 * watV) + watStep * (5 + 0.6 * watV)) / sr;
    const slapDec = Math.exp(-1 / ((watStep > 0.5 ? 0.025 : 0.07) * sr)), slapAmp = watStep > 0.5 ? 0.35 : 1;
    const pBub = 25 / sr, bubDec = Math.exp(-1 / (0.015 * sr));
    const ratDec = Math.exp(-1 / (0.003 * sr)), tickDec = Math.exp(-1 / (0.0015 * sr));
    const pBurst = creak * 1.2 / sr, pTick = creak * 6 / sr;
    const fStall = stallK === 1 ? 470 + 110 * stall : 400;
    const fMot = 165;
    const den = z[Z_DENS];
    // voices' per-block coefficients (a chirp sweeps)
    for (let i = 0; i < NV; i++) {
      const o = i * VW;
      if (v[o] !== VK_CHIRP) continue;
      const u = Math.min(1, v[o + 6] / v[o + 10]);
      const f = F_VOICE + i * 8;
      z[f + 6] = v[o + 8] + (v[o + 9] - v[o + 8]) * u; this.coef(f);
    }
    let r = this.rs[0] | 0;
    let nanHit = 0, clip = 0;
    for (let j = 0; j < n; j++) {
      const u = j * inv;
      r ^= r << 13; r ^= r >>> 17; r ^= r << 5;
      const w1 = r * 4.656612873077393e-10;          // white, [-1, 1)
      r ^= r << 13; r ^= r >>> 17; r ^= r << 5;
      const w2 = r * 4.656612873077393e-10;
      r ^= r << 13; r ^= r >>> 17; r ^= r << 5;
      const u01 = (r >>> 0) * 2.3283064365386963e-10; // uniform [0, 1)
      let ext = 0, air = 0, inn = 0;
      // ---- WIND ----
      if (doWind) {
        z[Z_GUST] += (w2 - z[Z_GUST]) * cGust;
        z[Z_BUFF] += (w1 - z[Z_BUFF]) * cBuff;
        const o = F_WIND;
        const v3 = w1 - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const bp = z[o + 5] * v1, lp = v2, hp = w1 - z[o + 5] * v1 - v2;
        let env = 1 + 0.25 * z[Z_GUST] * nGust + windT * 0.5 * z[Z_BUFF] * nBuff;
        if (env < 0) env = 0;
        const sig = 0.6 * lp + 0.9 * bp;
        ext += dA * (pWindL + (windL - pWindL) * u) * env * sig;
        z[Z_CABW] += (sig - z[Z_CABW]) * cCabW;
        const op = pOpen + (open - pOpen) * u;
        inn += (pWindI + (windI - pWindI) * u) * env * (op * (bp + 0.5 * hp) + (1 - op) * 2.2 * z[Z_CABW]);
      }
      // ---- GROUND ----
      if (doGnd) {
        const g = pGndL + (gndL - pGndL) * u;
        z[Z_R1] += (w2 - z[Z_R1]) * cRum; z[Z_R2] += (z[Z_R1] - z[Z_R2]) * cRum;
        z[Z_BUMP] += (w1 - z[Z_BUMP]) * cBump;
        const bm = z[Z_BUMP] * nBump;
        const rum = z[Z_R2] * nRum * (0.6 + 0.8 * (bm < 0 ? -bm : bm));
        let o = F_HISS;
        let v3 = w1 - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const hiss = z[o + 5] * v1;
        if (u01 < pGrain) z[Z_EG] += 0.5 + 0.5 * ((w2 + 1) * 0.5);
        z[Z_EG] *= gDec;
        o = F_CRUNCH;
        const xg = w2 * z[Z_EG];
        v3 = xg - z[o + 1]; v1 = z[o + 2] * z[o] + z[o + 3] * v3; v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const crunch = z[o + 5] * v1;
        let tone = 0;
        if (wT > 0.01) {
          o = F_TONE;
          v3 = w2 - z[o + 1]; v1 = z[o + 2] * z[o] + z[o + 3] * v3; v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
          z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
          tone = z[o + 5] * v1;
        }
        const gd = g * dG;
        ext += gd * (wR * rum + wH * hiss + 1.6 * crunch + 2.5 * wT * tone);
        air += gd * (0.25 * wH * hiss + 0.3 * crunch + 0.4 * wT * tone);
        inn += gd * 1.4 * wR * rum;
      }
      if (doRat) {
        const tr = pTailR + (tailR - pTailR) * u;
        if (u01 > 1 - pRat * tr) z[Z_ER] += 0.4 + 0.6 * ((w1 + 1) * 0.5);
        z[Z_ER] *= ratDec;
        const o = F_RATTLE, x = w2 * z[Z_ER];
        const v3 = x - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const rat = 2 * tr * z[o + 5] * v1;
        ext += 0.8 * rat; inn += 0.6 * rat;
      }
      if (doBrk) {
        z[Z_WANDER] += (w1 - z[Z_WANDER]) * cWan;
        const wn = z[Z_WANDER] * nWan;
        z[Z_PHB] += (1250 + 60 * wn) / sr; if (z[Z_PHB] >= 1) z[Z_PHB] -= 1;
        const ph = 6.283185307179586 * z[Z_PHB];
        const sq = (Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.5)) * 0.05 * (pBrk + (brk - pBrk) * u) * (0.7 + 0.3 * (wn < -1 ? -1 : wn > 1 ? 1 : wn));
        ext += sq; air += 0.6 * sq;
      }
      // ---- WATER ----
      if (doSpray) {
        const o = F_SPRAY;
        const v3 = w2 - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const sp = dW * (pWatL + (watL - pWatL) * u) * (0.6 + 0.4 * watStep) * 1.6 * z[o + 5] * v1;
        ext += sp; air += 0.5 * sp;
      }
      if (doSlap) {
        if (u01 < pSlap) z[Z_ES] += slapAmp * (0.5 + 0.5 * ((w1 + 1) * 0.5));
        z[Z_ES] *= slapDec;
        const o = F_SLAP, x = w1 * z[Z_ES];
        const v3 = x - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const sl = dW * 1.2 * (pWatSlap + (watSlap - pWatSlap) * u) * (v2 + 0.4 * z[o + 5] * v1);
        ext += sl; inn += 0.8 * sl;
      }
      if (doDrag) {
        const d = pWatDrag + (watDrag - pWatDrag) * u;
        z[Z_DRAG1] += (w1 - z[Z_DRAG1]) * cDrag; z[Z_DRAG2] += (z[Z_DRAG1] - z[Z_DRAG2]) * cDrag;
        z[Z_DRAGM] += (w2 - z[Z_DRAGM]) * cBump;
        const dm = z[Z_DRAGM] * nBump;
        if (u01 < pBub * d) z[Z_EB] += 0.5 + 0.5 * ((w2 + 1) * 0.5);
        z[Z_EB] *= bubDec;
        const o = F_BUB, x = w2 * z[Z_EB];
        const v3 = x - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const dr = 0.15 * d * (z[Z_DRAG2] * nDrag * 0.5 * (0.7 + 0.6 * (dm < 0 ? -dm : dm)) + 1.5 * z[o + 5] * v1);
        ext += dr; inn += 0.7 * dr;
      }
      // ---- STALL WARNING (interior only) ----
      if (doStall) {
        const s = pStall + (stall - pStall) * u;
        z[Z_PHV] += 5.3 / sr; if (z[Z_PHV] >= 1) z[Z_PHV] -= 1;
        z[Z_PHS] += fStall * (1 + 0.006 * Math.sin(6.283185307179586 * z[Z_PHV])) / sr; if (z[Z_PHS] >= 1) z[Z_PHS] -= 1;
        if (stallK === 1) {   // the reed: a soft-clipped sine (the reed's beat) plus the breath of the air through it
          const b = 2.2 * Math.sin(6.283185307179586 * z[Z_PHS]);
          const wave = b / (1 + (b < 0 ? -b : b)) + 0.25 * Math.sin(12.566370614359172 * z[Z_PHS]);
          const o = F_BREATH;
          const v3 = w2 - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
          z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
          const sp = s > 0 ? Math.pow(s, 1.3) : 0;
          inn += dS * 0.12 * sp * ((0.35 + 0.65 * s) * wave + (0.6 - 0.4 * s) * z[o + 5] * v1);
        } else {              // the buzzer: a square, softened
          const sq = z[Z_PHS] < 0.5 ? 1 : -1;
          z[Z_BUZLP] += (sq - z[Z_BUZLP]) * cBuz;
          inn += dS * 0.07 * s * z[Z_BUZLP];
        }
      }
      // ---- CREAKS AND RATTLES (interior only) ----
      if (doCreak) {
        const c = pCreak + (creak - pCreak) * u;
        if (z[Z_BURST] <= 0 && u01 < pBurst) {
          z[Z_BURST] = (0.08 + 0.17 * ((w1 + 1) * 0.5)) * sr; z[Z_BRATE] = (60 + 120 * ((w2 + 1) * 0.5)) / sr;
          z[Z_BAMP] = 0.4 + 0.6 * ((w1 + 1) * 0.5);
        }
        let imp = 0;
        if (z[Z_BURST] > 0) { z[Z_BURST]--; if (((w1 + 1) * 0.5) < z[Z_BRATE]) imp = w2 < 0 ? -z[Z_BAMP] : z[Z_BAMP]; }
        let o = F_CRK1;
        let v3 = imp - z[o + 1], v1 = z[o + 2] * z[o] + z[o + 3] * v3, v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const c1 = z[o + 5] * v1;
        o = F_CRK2;
        v3 = imp - z[o + 1]; v1 = z[o + 2] * z[o] + z[o + 3] * v3; v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        const c2 = z[o + 5] * v1;
        if (u01 > 1 - pTick) z[Z_ET] += 0.6 * ((w2 + 1) * 0.5);
        z[Z_ET] *= tickDec;
        o = F_TICK;
        const xt = w1 * z[Z_ET];
        v3 = xt - z[o + 1]; v1 = z[o + 2] * z[o] + z[o + 3] * v3; v2 = z[o + 1] + z[o + 3] * z[o] + z[o + 4] * v3;
        z[o] = 2 * v1 - z[o] + den; z[o + 1] = 2 * v2 - z[o + 1] + den;
        inn += dC * (0.5 + 0.5 * c) * (0.35 * (c1 + 0.6 * c2) * 6 + 0.05 * z[o + 5] * v1);
      }
      // ---- THE FLAP MOTOR ----
      if (doMot) {
        z[Z_PHM] += fMot / sr; if (z[Z_PHM] >= 1) z[Z_PHM] -= 1;
        z[Z_MOTLP] += (2 * z[Z_PHM] - 1 + 0.3 * w1 - z[Z_MOTLP]) * cMot;
        const m = (pFlapM + (flapM - pFlapM) * u) * z[Z_MOTLP];
        inn += 0.05 * m; ext += 0.012 * m;
      }
      // ---- THE ONE-SHOTS ----
      if (voices > 0) {
        for (let i = 0; i < NV; i++) {
          const o = i * VW;
          const kind = v[o];
          if (kind === 0) continue;
          if (v[o + 7] > 0) { v[o + 7]--; continue; }
          const f = F_VOICE + i * 8;
          let x;
          if (kind === VK_RING) x = v[o + 6] < v[o + 10] ? w1 : 0;   // a short noise strike rings the resonator
          else x = w1 * v[o + 5];
          const v3 = x - z[f + 1], v1 = z[f + 2] * z[f] + z[f + 3] * v3, v2 = z[f + 1] + z[f + 3] * z[f] + z[f + 4] * v3;
          z[f] = 2 * v1 - z[f] + den; z[f + 1] = 2 * v2 - z[f + 1] + den;
          let y;
          if (kind === VK_LOW) y = v2 * 2.2;
          else if (kind === VK_BAND) y = z[f + 5] * v1 * 2;
          else if (kind === VK_RING) y = z[f + 5] * v1 * 10;
          else {   // the chirp: the tyre's squeal, a tone sweeping down through its own band of noise
            v[o + 11] += z[f + 6] / sr; if (v[o + 11] >= 1) v[o + 11] -= 1;
            y = (Math.sin(6.283185307179586 * v[o + 11]) * 0.8 + z[f + 5] * v1 * 1.5) * v[o + 5];
          }
          y *= v[o + 3];
          if (kind === VK_RING) y *= v[o + 5];
          ext += v[o + 1] * y; inn += v[o + 2] * y;
          // the envelope: a chirp attacks over 4 ms and lasts its duration, then decays; the rest decay from the strike
          if (kind === VK_CHIRP && v[o + 6] < v[o + 10]) { const a = v[o + 5] + 1 / (0.004 * sr); v[o + 5] = a > 1 ? 1 : a; }
          else v[o + 5] *= v[o + 4];
          v[o + 6]++;
          if (v[o + 5] < 1e-4 && v[o + 6] > v[o + 10]) v[o] = 0;
        }
      }
      // ---- the cabin's placeholder low-pass on the airborne part, then out ----
      const op = pOpen + (open - pOpen) * u;
      z[Z_CAB] += (air - z[Z_CAB]) * cCab;
      inn += op * air + (1 - op) * z[Z_CAB];
      // DC blockers
      let yE = ext - z[Z_DCX0] + dcR * z[Z_DCY0]; z[Z_DCX0] = ext; z[Z_DCY0] = yE;
      let yI = inn - z[Z_DCX1] + dcR * z[Z_DCY1]; z[Z_DCX1] = inn; z[Z_DCY1] = yI;
      if (!(yE === yE) || !(yI === yI)) { nanHit = 1; yE = 0; yI = 0; }
      if (yE > 0.98) { yE = 0.98; clip++; } else if (yE < -0.98) { yE = -0.98; clip++; }
      if (yI > 0.98) { yI = 0.98; clip++; } else if (yI < -0.98) { yI = -0.98; clip++; }
      oE[j] = yE;
      if (oI) oI[j] = yI;
    }
    this.rs[0] = r;
    z[Z_DENS] = -den;   // the bias alternates sign: its own DC is zero
    if (clip) this.stats[2] += clip;
    if (nanHit) { this.stats[1]++; this.z.fill(0); this.v.fill(0); z[Z_DENS] = AF_DENORMAL; z[Z_SW] = 1; }
    this.keep(params);
    return true;
  }
  // the block's targets become the next block's start (written out: a keyed load by a computed name allocated ~30 B a block)
  keep (params) {
    const z = this.z, P = Z_PREV;
    z[P + 0] = params.windL[0]; z[P + 1] = params.windF[0]; z[P + 2] = params.windT[0]; z[P + 3] = params.windI[0];
    z[P + 4] = params.gndL[0]; z[P + 5] = params.gndS[0]; z[P + 6] = params.gndV[0]; z[P + 7] = params.tailR[0];
    z[P + 8] = params.brk[0]; z[P + 9] = params.watL[0]; z[P + 10] = params.watV[0]; z[P + 11] = params.watStep[0];
    z[P + 12] = params.watSlap[0]; z[P + 13] = params.watDrag[0]; z[P + 14] = params.stall[0]; z[P + 15] = params.stallK[0];
    z[P + 16] = params.creak[0]; z[P + 17] = params.flapM[0]; z[P + 18] = params.open[0]; z[P + 19] = params.duck[0];
  }
}

registerProcessor('flydiy-airframe', FlyDiyAirframeProcessor);

// node (the offline harness and GATE AUDIO): the same class, no second copy
if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = { FlyDiyAirframeProcessor, AF_PARAM_NAMES, AF_SURF, AF_DENORMAL };
}
