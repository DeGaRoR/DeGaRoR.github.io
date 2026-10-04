/*
 * flyDiy — THE PROPELLER, THE TURBINE AND THE ELECTRIC MOTOR (SND-PROP, G1620-G1629;
 * SOUND-2026-10-04 §3.2-§3.4). One AudioWorklet module, three processors:
 *
 *   'flydiy-prop'      the propeller of one engine. Driven, per sample, by the
 *                      engine voice's CONTROL OUTPUT (output 1 of 'flydiy-engine',
 *                      'flydiy-turbine' or 'flydiy-electric': engine rpm / 1000,
 *                      prop rpm / 1000) connected as this node's input 0, so the
 *                      prop turns with the cranking, the catch surge and the
 *                      run-down the engine voice makes. Unconnected, it falls back
 *                      to its k-rate `rpm` (prop) x `gear`.
 *   'flydiy-turbine'   a free-turbine turboprop's engine (the PT6 rows): the
 *                      compressor's tone stack, the combustion roar, the spool.
 *   'flydiy-electric'  an electric motor: the pole-pair whine and the inverter's
 *                      PWM tones, very quiet (the prop dominates, §3.4).
 *   The turbine and electric voices publish the SAME control output as the
 *   piston voice (output 1: driver rpm / 1000, prop rpm / 1000), so every prop
 *   node is wired the same way whatever turns it.
 *
 * NOT A PORT: no code is taken from anywhere. The physics it follows:
 *  - GUTIN (1936; any aeroacoustics text): the steady-loading tones at m B Omega,
 *    level ~ m B Omega / c x (thrust and torque terms) x J_mB(m B M_e sin theta),
 *    M_e the Mach number at ~0.8 R. The Bessel factor is what makes the levels
 *    rise steeply with tip Mach and the harmonic roll-off flatten toward sonic;
 *    computed here exactly (Miller's backward recurrence, per block) at one
 *    representative emission angle near the disc plane (directivity is
 *    SND-SPACE's, wave 3: this voice is the source, not the listener).
 *  - SELFRIDGE, MOFFAT & REISS, "Physically derived sound synthesis model of a
 *    propeller" (Audio Mostly 2017, doi 10.1145/3123514.3123524): the blade as
 *    compact sources along its span, each shedding at a Strouhal frequency of
 *    its own section speed (St U / t, U = hypot(Omega r, V)), the intensity of
 *    each rising as U^6 (an aeolian dipole: amplitude U^3). (The paper's text
 *    was not reachable from the build box — egress blocked — so this is its
 *    method as cited in SOUND §1.2 and the authors' companion aeolian-tone work,
 *    not a transcription; SND-TUNE tunes it against recordings, §8.)
 *  - unsteady loading: a blade at incidence (alpha, sideslip) sees its load
 *    vary once a revolution (1P sidebands round each tone, a slower harmonic
 *    roll-off) and its wake chops the broadband at BPF — the "whop" (§3.2 chop).
 *  - Farnell, Designing Sound (2010), practicals 24 (jet) and the motors
 *    practical: the turbine's tone stack + roar and the motor's whine, as
 *    methods (no code).
 *
 * THE API
 *   new AudioWorkletNode(ctx, 'flydiy-prop', {
 *     numberOfInputs: 1, numberOfOutputs: 2, outputChannelCount: [1, 2],
 *     channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete',
 *     processorOptions: { config: propSoundConfig(...).prop, seed } })
 *   engineNode.connect(propNode, 1, 0)          // the engine's control output
 *   output 0 — 1 channel: the prop, mono (tonal + broadband)
 *   output 1 — 2 channels: [tonal (+ snarl, gear whine), broadband (+ chop)]
 *              — the same sound split, for SND-SPACE to pan / filter apart
 *   AudioParams (k-rate):
 *     rpm 0..30000   prop rpm (only when nothing drives input 0)
 *     thrust         this engine's thrust, N (out.thrustPer[i]); / cfg.Tstatic
 *     thr 0..1       the engine's lever (torque loading), x running
 *     c              speed of sound, m/s (out.c) — tip Mach is computed per
 *                    block from the LIVE prop rpm (a cranking prop is quiet)
 *     V              true airspeed, m/s (helical tip Mach, section speeds)
 *     alpha, beta    rad (incidence: chop depth, 1P, unsteady harmonics)
 *     interior 0|1   the cockpit eye: more chop (the disc beside the windscreen),
 *                    less of the trailing-edge hiss (a starting point: the cabin
 *                    itself is SND-SPACE's)
 *
 *   new AudioWorkletNode(ctx, 'flydiy-turbine' | 'flydiy-electric', {
 *     numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
 *     processorOptions: { config: propSoundConfig(...).driver, seed, running, rpm } })
 *   output 0 — 1 channel: the engine (whine, roar | whine, PWM)
 *   output 1 — 2 channels, control: driver rpm / 1000 (the gas generator's Ng
 *              rpm | the motor's rpm), prop rpm / 1000 — the prop node's input
 *   AudioParams (k-rate): rpm (prop rpm, out.rpm[i]), power 0..1 (the lever x
 *              running), running 0|1, starter 0|1 (turbine)
 *
 * ALLOCATION-FREE BY CONSTRUCTION (G1610's lesson): every per-block and
 * per-sample computation is inline in process(); state lives in Float64Arrays
 * read into locals and written back once a block; the random source is
 * xorshift32 on a typed cell; no call takes or returns a double.
 */
'use strict';

const PROP_TWO_PI = 2 * Math.PI;
const PROP_R30 = 1 / 1073741824;           // 2^-30
const PROP_NH = 8;                          // tonal harmonics m = 1..8
const PROP_NS = 4;                          // broadband span sections
// the span sections (r / R) and their nominal thickness (fraction of D): the
// wake's shedding scale; outboard thinner and faster -> higher, louder
const PROP_SEC_R = [0.45, 0.65, 0.80, 0.95];
const PROP_SEC_T = [0.020, 0.014, 0.010, 0.007];
const PROP_SEC_W = [0.35, 0.6, 0.85, 1.0];  // span weight (outboard dominates)
const PROP_ST = 0.2;                        // Strouhal number of the wake
const PROP_SIN_THETA = 0.966;               // the representative emission angle: 75 deg off the axis
const PROP_ME_R = 0.8;                      // Gutin's effective radius, r / R
const PROP_REF_MH = 0.65;                   // the level reference: a GA prop's static helical tip Mach

// soft saturation: x (27 + x^2) / (27 + 9 x^2) ~ tanh for |x| < 3, clamped beyond
// (written inline where used; this note is the formula)

// the Bessel factor J_n(x), Miller's backward recurrence (Numerical Recipes'
// bessj), x < n always here (z < 1). Used per block only. Writes into o[k].
// Plain ints in, the double out through a typed slot: never boxed.
function propBesselInto(n, x, o, k) {
  if (!(x > 1e-9)) { o[k] = 0; return; }
  const tox = 2 / x;
  const m = 2 * ((n + ((Math.sqrt(160 * n)) | 0)) >> 1);
  let jsum = 0, bjp = 0, ans = 0, sum = 0, bj = 1;
  for (let j = m; j > 0; j--) {
    const bjm = j * tox * bj - bjp;
    bjp = bj; bj = bjm;
    if (Math.abs(bj) > 1e10) { bj *= 1e-10; bjp *= 1e-10; ans *= 1e-10; sum *= 1e-10; }
    if (jsum) sum += bj;
    jsum = jsum ? 0 : 1;
    if (j === n) ans = bjp;
  }
  sum = 2 * sum - bj;
  o[k] = sum !== 0 ? ans / sum : 0;
}


// ============================================================================
// THE PROPELLER
// ============================================================================
class FlyDiyPropProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      { name: 'rpm',      defaultValue: 0,   minValue: 0,    maxValue: 30000, automationRate: 'k-rate' },
      { name: 'thrust',   defaultValue: 0,   minValue: -1e6, maxValue: 1e6,   automationRate: 'k-rate' },
      { name: 'thr',      defaultValue: 0,   minValue: 0,    maxValue: 1,     automationRate: 'k-rate' },
      { name: 'c',        defaultValue: 340, minValue: 200,  maxValue: 400,   automationRate: 'k-rate' },
      { name: 'V',        defaultValue: 0,   minValue: 0,    maxValue: 400,   automationRate: 'k-rate' },
      { name: 'alpha',    defaultValue: 0,   minValue: -4,   maxValue: 4,     automationRate: 'k-rate' },
      { name: 'beta',     defaultValue: 0,   minValue: -4,   maxValue: 4,     automationRate: 'k-rate' },
      { name: 'interior', defaultValue: 0,   minValue: 0,    maxValue: 1,     automationRate: 'k-rate' },
    ];
  }

  constructor (options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.sr = sampleRate;
    this.rs = new Uint32Array(1);
    // per-block targets and per-sample state, all typed (see the head)
    this.amp = new Float64Array(PROP_NH);       // harmonic amplitudes now (ramped toward tgt)
    this.ampT = new Float64Array(PROP_NH);      // ...their targets this block
    this.jv = new Float64Array(PROP_NH + 1);    // Bessel factors (slot NH: the reference)
    this.sec = new Float64Array(PROP_NS * 7);   // per section: a1 a2 a3 ic1 ic2 gain gainT
    // the scalar state: 0 phase (blade passages, 0..1), 1 shaft phase (revs, 0..1), 2 gear-whine phase,
    // 3 rpm (smoothed fallback), 4 blade gain (the passage's irregularity), 5 dc x tonal, 6 dc y tonal,
    // 7 dc x broadband, 8 dc y broadband, 9 chop depth, 10 1P depth, 11 snarl drive, 12 whine amp,
    // 13 broadband level, 14 irregularity, 15 asleep (s), 16 tonal level, 17 mesh whine target
    this.st = new Float64Array(20);
    // for the gate and the dev panel: 0 tip Mach, 1 helical tip Mach, 2 loading, 3 snarl, 4 chop depth,
    // 5 beta buzz, 6 BPF Hz (last block), 7 blocks asleep
    this.stats = new Float64Array(8);
    this._build(po.config || null, po.seed);
    if (this.port) this.port.onmessage = (e) => {
      const m = e && e.data;
      if (m && m.type === 'config') this._build(m.config, m.seed == null ? this.seed : m.seed);
    };
  }

  _build (cfg, seed) {
    const c = cfg || {};
    this.cfg = c;
    this.seed = (seed >>> 0) || 1;
    this.rs[0] = (this.seed * 2654435761) >>> 0 || 1;
    this.blades = Math.max(1, Math.min(8, (c.blades | 0) || 2));
    this.D = c.D > 0 ? +c.D : 1.8;
    this.Tstatic = c.Tstatic > 0 ? +c.Tstatic : 1000;
    this.gear = c.gear > 0 ? +c.gear : 1;
    this.pinion = c.pinion > 0 ? +c.pinion : 0;     // gear-whine teeth (0 = direct drive: none)
    this.gain = c.gain > 0 ? +c.gain : 0.12;
    this.bbGain = c.broadband != null ? +c.broadband : 0.5;
    this.whineGain = c.whine != null ? +c.whine : 0.03;
    this.thick = c.thickness != null ? +c.thickness : 0.25;
    this.unsteady = c.unsteady != null ? +c.unsteady : 0.06;
    this.irreg = c.irregularity != null ? +c.irregularity : 0.03;
    this.snarlK = c.snarl != null ? +c.snarl : 1;     // 0 switches the snarl off (the gate's control)
    this.amp.fill(0); this.ampT.fill(0); this.sec.fill(0); this.st.fill(0);
    this.st[4] = 1;
    this.dcR = 1 - PROP_TWO_PI * 5 / this.sr;
    // THE LEVEL REFERENCE: the Gutin fundamental at the reference helical tip Mach
    const B = this.blades, z0 = PROP_ME_R * PROP_REF_MH * PROP_SIN_THETA;
    propBesselInto(B, B * z0, this.jv, PROP_NH);
    this.jRef = PROP_REF_MH * this.jv[PROP_NH];
  }

  process (inputs, outputs, parameters) {
    const out0 = outputs[0];
    if (!out0 || !out0.length) return true;
    const y0 = out0[0], n = y0.length;
    const o1 = outputs.length > 1 && outputs[1] && outputs[1].length >= 2 ? outputs[1] : null;
    const yT = o1 ? o1[0] : null, yB = o1 ? o1[1] : null;
    const inp = inputs && inputs[0];
    const drv = inp && inp.length >= 2 ? inp : null;
    const inE = drv ? drv[0] : null, inP = drv ? drv[1] : null;
    const P = parameters, sr = this.sr, st = this.st, S = this.stats;
    const B = this.blades, D = this.D, R = 0.5 * D;

    // ---- THE BLOCK: what the aeroplane says, once ------------------------------------------
    let rpmK = P.rpm ? +P.rpm[0] : 0; if (!(rpmK >= 0)) rpmK = 0; else if (rpmK > 30000) rpmK = 30000;
    let thrust = P.thrust ? +P.thrust[0] : 0; if (!(thrust >= -1e6 && thrust <= 1e6)) thrust = 0;
    let thr = P.thr ? +P.thr[0] : 0; if (!(thr >= 0)) thr = 0; else if (thr > 1) thr = 1;
    let c = P.c ? +P.c[0] : 340; if (!(c >= 200)) c = 340;
    let V = P.V ? +P.V[0] : 0; if (!(V >= 0)) V = 0; else if (V > 400) V = 400;
    let al = P.alpha ? +P.alpha[0] : 0; if (!(al >= -4 && al <= 4)) al = 0;   // (NaN and +-Infinity fail both)
    let be = P.beta ? +P.beta[0] : 0; if (!(be >= -4 && be <= 4)) be = 0;
    let inn = P.interior ? +P.interior[0] : 0; if (!(inn >= 0)) inn = 0; else if (inn > 1) inn = 1;
    // the prop's speed this block: the driver's last sample (or the fallback), for the per-block numbers
    let rpmB;
    if (inP) { rpmB = +inP[n - 1] * 1000; if (!(rpmB >= 0)) rpmB = 0; }
    else { rpmB = st[3] + (rpmK - st[3]) * (1 - Math.exp(-n / (0.05 * sr))); }
    const tip = Math.PI * D * rpmB / 60;
    const Mt = tip / c, Mh = Math.sqrt(tip * tip + V * V) / c;
    // the loading: thrust over the static thrust (a windmilling prop's negative thrust loads it too), and the
    // torque the lever asks for; incidence only means something once there is airflow
    let tN = Math.abs(thrust) / this.Tstatic; if (tN > 1.6) tN = 1.6;
    const L = 0.6 * tN + 0.4 * thr;
    let u = V <= 5 ? 0 : V >= 15 ? 1 : (V - 5) / 10;
    const flow = u * u * (3 - 2 * u);
    const inc = flow * (Math.abs(Math.sin(al)) + 0.8 * Math.abs(Math.sin(be)));
    // THE SNARL: above helical tip Mach ~0.85 the upper harmonics rise and the wave saturates
    u = Mh <= 0.82 ? 0 : Mh >= 1 ? 1 : (Mh - 0.82) / 0.18;
    const sn = u * u * (3 - 2 * u) * this.snarlK;
    // THE BETA BUZZ: high tip speed with almost no thrust (a PT6 at taxi, the governor holding Np, the blades
    // flat): the outboard sections at negative incidence, separated - a buzzy irregular upper spectrum
    u = Mh <= 0.5 ? 0 : Mh >= 0.7 ? 1 : (Mh - 0.5) / 0.2;
    let u2 = tN <= 0.08 ? 0 : tN >= 0.3 ? 1 : (tN - 0.08) / 0.22;
    const bz = u * u * (3 - 2 * u) * (1 - u2 * u2 * (3 - 2 * u2)) * (thr < 0.35 ? 1 : 0);
    // the Gutin tones: steady loading + thickness, times the Bessel factor, normalised to the reference
    const z = PROP_ME_R * Mh * PROP_SIN_THETA;
    const jRef = this.jRef > 1e-12 ? this.jRef : 1e-12;
    const steady = L + this.thick * Mh * Mh / (PROP_REF_MH * PROP_REF_MH);
    const un = (this.unsteady + 0.9 * inc + 0.35 * bz) * (0.3 + L);
    const turning = rpmB > 1 ? 1 : 0;
    let tonal = 0, aF = 0;
    for (let m = 1; m <= PROP_NH; m++) {
      // J_mB(m B z), Miller's backward recurrence written inline (a call passing a double would box it)
      const nB = m * B, xB = nB * (z < 0.985 ? z : 0.985);
      let jmb = 0;
      if (xB > 1e-9) {
        const tox = 2 / xB, mm = 2 * ((nB + ((Math.sqrt(160 * nB)) | 0)) >> 1);
        let jsum = 0, bjp = 0, ans = 0, sum = 0, bj = 1;
        for (let j = mm; j > 0; j--) {
          const bjm = j * tox * bj - bjp;
          bjp = bj; bj = bjm;
          if (bj > 1e10 || bj < -1e10) { bj *= 1e-10; bjp *= 1e-10; ans *= 1e-10; sum *= 1e-10; }
          if (jsum) sum += bj;
          jsum = jsum ? 0 : 1;
          if (j === nB) ans = bjp;
        }
        sum = 2 * sum - bj;
        jmb = sum !== 0 ? ans / sum : 0;
      }
      this.jv[m - 1] = jmb;
      let a = steady * Mh * m * jmb / jRef;
      // the unsteady floor: a slower roll-off, growing with incidence (sidebands' parent)
      a += un * Math.pow(m, -1.3) * Mh / PROP_REF_MH;
      // THE SNARL'S LIFT: a transonic tip's thickness pulse steepens toward a shock - an impulse per blade, whose
      // spectrum is flat: every m >= 2 rises toward the fundamental's level
      if (m === 1) aF = a;
      else a += sn * 0.7 * aF * (0.6 + 0.4 * Mh);
      this.ampT[m - 1] = a > 1e-9 ? a * turning : 0;   // (a high order's Bessel factor can be 1e-40: inaudible, and kept out of the state)
      tonal += a;
    }
    // level guard: very high tip Mach (a 30 % over-speed) cannot run the sum away
    const lim = 3.0;
    if (tonal > lim) for (let m = 0; m < PROP_NH; m++) this.ampT[m] *= lim / tonal;
    // the chop at BPF (broadband, and a share of the tonal), and the 1P load wobble at incidence
    let chop = 0.15 + 1.4 * inc + 0.25 * inn + 0.2 * bz; if (chop > 0.9) chop = 0.9;
    let p1 = 1.2 * inc; if (p1 > 0.5) p1 = 0.5;
    const drive = 1 + 1.2 * sn;   // mild: a hard clip would shave off the very spikes the snarl is made of
    // the broadband: per section, a band-pass at St U / t, amplitude ~ U^3 (U^6 intensity), with loading
    const om = rpmB * PROP_TWO_PI / 60;
    const Uref = PROP_REF_MH * 340 * 0.8;
    const bbL = (0.35 + 0.65 * L + 0.3 * bz) * (1 - 0.5 * inn) * this.bbGain;
    const sec = this.sec;
    for (let k = 0; k < PROP_NS; k++) {
      const r = PROP_SEC_R[k] * R, U = Math.sqrt(om * om * r * r + V * V);
      let fc = PROP_ST * U / (PROP_SEC_T[k] * D);
      if (fc < 40) fc = 40; else if (fc > 0.42 * sr) fc = 0.42 * sr;
      const g = Math.tan(Math.PI * fc / sr), kq = 1 / 1.1;     // Q 1.1: a turbulent wake is broad
      const a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
      const o = k * 7;
      sec[o] = a1; sec[o + 1] = a2; sec[o + 2] = a3;
      const u3 = U / Uref;
      sec[o + 6] = turning * bbL * PROP_SEC_W[k] * u3 * u3 * u3 * 0.25;
    }
    // the gear whine: the reduction gear's mesh, engine rpm x pinion teeth, with the torque
    const whT = this.pinion > 0 ? this.whineGain * (0.25 + 0.75 * thr) * (rpmB > 50 ? 1 : 0) : 0;
    S[0] = Mt; S[1] = Mh; S[2] = L; S[3] = sn; S[4] = chop; S[5] = bz; S[6] = rpmB / 60 * B;

    // sleep: a stopped prop, its tails rung out, computes nothing
    let quiet = st[15];
    if (rpmB < 1 && rpmK < 1) quiet += n / sr; else quiet = 0;
    st[15] = quiet;
    if (quiet > 1.0) {
      y0.fill(0); if (o1) { yT.fill(0); yB.fill(0); }
      if (quiet < 1.0 + 2 * n / sr) {          // just asleep: clear every tail (also the last word on denormals)
        this.amp.fill(0); for (let k = 0; k < PROP_NS; k++) { sec[k * 7 + 3] = 0; sec[k * 7 + 4] = 0; sec[k * 7 + 5] = 0; }
        st[5] = st[6] = st[7] = st[8] = 0; st[12] = 0;
      }
      st[3] = rpmK; S[7] += 1;
      return true;
    }

    // ---- THE SAMPLES -------------------------------------------------------------------------
    const amp = this.amp, ampT = this.ampT, gain = this.gain, irr = this.irreg;
    const kA = 1 / n;
    let ph = st[0], ps = st[1], pw = st[2], rpmS = st[3], bg = st[4];
    let dxT = st[5], dyT = st[6], dxB = st[7], dyB = st[8];
    let ch = st[9], pp = st[10], dr = st[11], wh = st[12];
    const dcR = this.dcR, pin = this.pinion, gearR = this.gear;
    const aK = 1 - Math.exp(-1 / (0.05 * sr));
    let rs = this.rs[0] | 0;
    // per-sample ramps of the block's targets
    const dCh = (chop - ch) * kA, dPp = (p1 - pp) * kA, dDr = (drive - dr) * kA, dWh = (whT - wh) * kA;
    const s0 = sec[0 * 7 + 6] - sec[0 * 7 + 5], s1 = sec[1 * 7 + 6] - sec[1 * 7 + 5];
    const s2 = sec[2 * 7 + 6] - sec[2 * 7 + 5], s3 = sec[3 * 7 + 6] - sec[3 * 7 + 5];
    let g0 = sec[5], g1 = sec[12], g2 = sec[19], g3 = sec[26];
    let i10 = sec[3], i20 = sec[4], i11 = sec[10], i21 = sec[11], i12 = sec[17], i22 = sec[18], i13 = sec[24], i23 = sec[25];
    const A10 = sec[0], A20 = sec[1], A30 = sec[2], A11 = sec[7], A21 = sec[8], A31 = sec[9];
    const A12 = sec[14], A22 = sec[15], A32 = sec[16], A13 = sec[21], A23 = sec[22], A33 = sec[23];
    const a0 = amp[0], a1 = amp[1], a2 = amp[2], a3 = amp[3], a4 = amp[4], a5 = amp[5], a6 = amp[6], a7 = amp[7];
    const d0 = (ampT[0] - a0) * kA, d1 = (ampT[1] - a1) * kA, d2 = (ampT[2] - a2) * kA, d3 = (ampT[3] - a3) * kA;
    const d4 = (ampT[4] - a4) * kA, d5 = (ampT[5] - a5) * kA, d6 = (ampT[6] - a6) * kA, d7 = (ampT[7] - a7) * kA;
    let pkE = 0;
    for (let s = 0; s < n; s++) {
      // the prop's and the engine's speed, this sample
      let rp, re;
      if (inP) {
        rp = +inP[s] * 1000; if (!(rp >= 0)) rp = 0;
        re = +inE[s] * 1000; if (!(re >= 0)) re = rp * gearR;
      } else {
        rpmS += aK * (rpmK - rpmS); rp = rpmS; re = rp * gearR;
      }
      // the phases: blade passages, shaft revolutions, gear mesh
      ps += rp / (60 * sr); if (ps >= 1) ps -= Math.floor(ps);
      ph += rp * B / (60 * sr);
      if (ph >= 1) {
        ph -= Math.floor(ph);
        // a new blade passage: this blade's irregularity (a real prop's blades are not twins; at beta, buzzy)
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        bg = 1 + (irr + 0.25 * bz) * (2 * (rs >>> 2) * PROP_R30 - 1);
      }
      const f = s * kA;
      // the tonal: sum a_m sin(m theta) by the Chebyshev recurrence (one sin, one cos)
      const th = PROP_TWO_PI * ph, sn1 = Math.sin(th), c2 = 2 * Math.cos(th);
      let sm2 = 0, sm1 = sn1, t = (a0 + d0 * s) * sn1, sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a1 + d1 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a2 + d2 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a3 + d3 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a4 + d4 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a5 + d5 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a6 + d6 * s) * sx;
      sx = c2 * sm1 - sm2; sm2 = sm1; sm1 = sx; t += (a7 + d7 * s) * sx;
      ch += dCh; pp += dPp; dr += dDr; wh += dWh;
      // the 1P wobble (a blade at incidence loads and unloads once a revolution) and the blade's own gain
      t *= bg * (1 + pp * Math.sin(PROP_TWO_PI * ps));
      // the snarl: soft saturation at the drive, level-matched
      let x = t * dr * 0.6;
      if (x > 3) x = 3; else if (x < -3) x = -3;
      t = x * (27 + x * x) / (27 + 9 * x * x) / (dr * 0.6);
      // the chop: a raised-cosine pulse per blade passage, mean 1
      const cp = 0.5 + 0.5 * Math.cos(th), pulse = cp * cp;
      const mod = 1 + ch * (pulse - 0.375) / 0.625;
      t *= 1 + 0.3 * (mod - 1);
      // the broadband: four sections' band-passed noise (TPT state-variable filters), chopped
      let bb = 0, v0, v1, v2, v3;
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; v0 = (2 * (rs >>> 2) * PROP_R30 - 1) * (g0 + s0 * f);
      v3 = v0 - i20; v1 = A10 * i10 + A20 * v3; v2 = i20 + A20 * i10 + A30 * v3; i10 = 2 * v1 - i10; i20 = 2 * v2 - i20; bb += v1;
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; v0 = (2 * (rs >>> 2) * PROP_R30 - 1) * (g1 + s1 * f);
      v3 = v0 - i21; v1 = A11 * i11 + A21 * v3; v2 = i21 + A21 * i11 + A31 * v3; i11 = 2 * v1 - i11; i21 = 2 * v2 - i21; bb += v1;
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; v0 = (2 * (rs >>> 2) * PROP_R30 - 1) * (g2 + s2 * f);
      v3 = v0 - i22; v1 = A12 * i12 + A22 * v3; v2 = i22 + A22 * i12 + A32 * v3; i12 = 2 * v1 - i12; i22 = 2 * v2 - i22; bb += v1;
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; v0 = (2 * (rs >>> 2) * PROP_R30 - 1) * (g3 + s3 * f);
      v3 = v0 - i23; v1 = A13 * i13 + A23 * v3; v2 = i23 + A23 * i13 + A33 * v3; i13 = 2 * v1 - i13; i23 = 2 * v2 - i23; bb += v1;
      bb *= mod;
      // the gear whine (geared engines): the mesh and its second harmonic
      if (pin > 0 && wh > 1e-7) {
        pw += re * pin / (60 * sr); if (pw >= 1) pw -= Math.floor(pw);
        const q = PROP_TWO_PI * pw;
        t += wh * (Math.sin(q) + 0.3 * Math.sin(2 * q));
      }
      t *= gain; bb *= gain;
      // DC blockers (5 Hz), per part
      const yt = t - dxT + dcR * dyT; dxT = t; dyT = yt;
      const yb = bb - dxB + dcR * dyB; dxB = bb; dyB = yb;
      let y = yt + yb;
      if (y !== y) {                      // a NaN reached the state: silence, never ring
        i10 = i20 = i11 = i21 = i12 = i22 = i13 = i23 = 0; dxT = dyT = dxB = dyB = 0; ph = ps = pw = 0; rpmS = 0; bg = 1;
        y = 0; y0[s] = 0; if (o1) { yT[s] = 0; yB[s] = 0; }
        continue;
      }
      y0[s] = y;
      if (o1) { yT[s] = yt; yB[s] = yb; }
      const ay = y < 0 ? -y : y; if (ay > pkE) pkE = ay;
    }
    // write the state back; flush the filter states below hearing (no subnormal can form)
    if (i10 < 1e-20 && i10 > -1e-20) i10 = 0; if (i20 < 1e-20 && i20 > -1e-20) i20 = 0;
    if (i11 < 1e-20 && i11 > -1e-20) i11 = 0; if (i21 < 1e-20 && i21 > -1e-20) i21 = 0;
    if (i12 < 1e-20 && i12 > -1e-20) i12 = 0; if (i22 < 1e-20 && i22 > -1e-20) i22 = 0;
    if (i13 < 1e-20 && i13 > -1e-20) i13 = 0; if (i23 < 1e-20 && i23 > -1e-20) i23 = 0;
    if (dxT < 1e-20 && dxT > -1e-20) dxT = 0; if (dyT < 1e-20 && dyT > -1e-20) dyT = 0;
    if (dxB < 1e-20 && dxB > -1e-20) dxB = 0; if (dyB < 1e-20 && dyB > -1e-20) dyB = 0;
    sec[3] = i10; sec[4] = i20; sec[10] = i11; sec[11] = i21;
    sec[17] = i12; sec[18] = i22; sec[24] = i13; sec[25] = i23;
    sec[5] = sec[6]; sec[12] = sec[13]; sec[19] = sec[20]; sec[26] = sec[27];
    for (let m = 0; m < PROP_NH; m++) amp[m] = ampT[m];
    st[0] = ph; st[1] = ps; st[2] = pw; st[3] = rpmS; st[4] = bg;
    st[5] = dxT; st[6] = dyT; st[7] = dxB; st[8] = dyB;
    st[9] = ch; st[10] = pp; st[11] = dr; st[12] = wh;
    this.rs[0] = rs;
    return true;
  }
}

// ============================================================================
// THE TURBINE (a free-turbine turboprop: the PT6 rows, §3.3)
// ============================================================================
// The solver publishes the prop's rpm only (constant-speed: the governor holds
// it while running). The gas generator's speed Ng is DERIVED from the power
// asked (the lever x running): idle ~52 %, 100 % at full power, a spool of its
// own (accelerations ~1.5 s, a long whine down after shutdown), the starter's
// ~17 % before light-off. The prop's speed has its own inertia (the voice's
// control output carries both).
const TURB_ST = 24;   // state slots
class FlyDiyTurbineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      { name: 'rpm',     defaultValue: 0, minValue: 0, maxValue: 30000, automationRate: 'k-rate' },
      { name: 'power',   defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
      { name: 'running', defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
      { name: 'starter', defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
    ];
  }
  constructor (options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.sr = sampleRate;
    this.rs = new Uint32Array(1);
    // 0 ng (0..1.05), 1 np (rpm), 2..7 tone phases, 8 lp1, 9 lp2, 10 bp ic1, 11 bp ic2, 12 dc x, 13 dc y,
    // 14 level, 15 quiet s
    this.st = new Float64Array(TURB_ST);
    this.tone = new Float64Array(12);   // per tone: freq multiplier (x Ng rev/s), amplitude
    this.stats = new Float64Array(4);   // 0 ng, 1 np, 2 roar level, 3 first-stage Hz
    this._build(po.config || null, po.seed);
    if (po.running) { this.st[0] = this._ngOf(0); this.st[1] = po.rpm > 0 ? +po.rpm : this.ratedProp; }
    if (this.port) this.port.onmessage = (e) => {
      const m = e && e.data;
      if (m && m.type === 'config') this._build(m.config, m.seed == null ? this.seed : m.seed);
    };
  }
  _ngOf (power) { return this.ngIdle + (1.01 - this.ngIdle) * Math.pow(power, 0.7); }
  _build (cfg, seed) {
    const c = cfg || {};
    this.cfg = c; this.seed = (seed >>> 0) || 1; this.rs[0] = (this.seed * 2246822519) >>> 0 || 1;
    this.ngMax = c.ngMaxRpm > 0 ? +c.ngMaxRpm : 37500;
    this.ngIdle = c.ngIdle > 0 ? +c.ngIdle : 0.52;
    this.ngStart = c.ngStart > 0 ? +c.ngStart : 0.17;
    this.ratedProp = c.ratedPropRpm > 0 ? +c.ratedPropRpm : 1900;
    this.gain = c.gain > 0 ? +c.gain : 0.1;
    const stages = Array.isArray(c.stages) && c.stages.length ? c.stages : [26, 39, 44];
    const imp = c.impeller > 0 ? +c.impeller : 30;
    // the tone stack: each axial stage's blade passing, the centrifugal impeller's, the first stage's 2nd
    // harmonic; amplitudes falling a little stage by stage (the intake screen hears the first stage best)
    const T = this.tone; T.fill(0);
    let k = 0;
    for (let s = 0; s < Math.min(3, stages.length); s++) { T[k++] = +stages[s]; T[k++] = 0.9 * Math.pow(0.6, s); }
    T[k++] = imp; T[k++] = 0.3;
    T[k++] = 2 * (+stages[0]); T[k++] = 0.2;
    this.nTone = k >> 1;
    this.roar = c.roar != null ? +c.roar : 0.6;
    this.st.fill(0);
    this.dcR = 1 - PROP_TWO_PI * 5 / this.sr;
  }
  process (inputs, outputs, parameters) {
    const out0 = outputs[0];
    if (!out0 || !out0.length) return true;
    const y0 = out0[0], n = y0.length, sr = this.sr, st = this.st, T = this.tone;
    const ctl = outputs.length > 1 && outputs[1] && outputs[1].length >= 2 ? outputs[1] : null;
    const P = parameters;
    let rpm = P.rpm ? +P.rpm[0] : 0; if (!(rpm >= 0)) rpm = 0; else if (rpm > 30000) rpm = 30000;
    let pw = P.power ? +P.power[0] : 0; if (!(pw >= 0)) pw = 0; else if (pw > 1) pw = 1;
    const run = P.running ? P.running[0] > 0.5 : false, sta = P.starter ? P.starter[0] > 0.5 : false;
    const dt = n / sr;
    let ng = st[0], np = st[1];
    // the spool: Ng toward its target; Np toward the governor's (the solver's) speed
    const ngI = this.ngIdle, ngT = run ? ngI + (1.01 - ngI) * Math.pow(pw, 0.7) : sta ? this.ngStart : 0;
    const tauG = run ? (ngT > ng ? (ng < this.ngIdle * 0.9 ? 2.5 : 1.5) : 2.0) : (sta ? 1.0 : 6.0);
    const npT = rpm;   // the solver's Np (the governor's, constant-speed while running); the voice adds the inertia
    const tauP = run ? 2.0 : 6.0;
    const kG = 1 - Math.exp(-1 / (tauG * sr)), kP = 1 - Math.exp(-1 / (tauP * sr));
    // the roar: combustion with the fuel flow (power), only once lit
    const lit = run ? 1 : 0;
    const roarT = this.roar * lit * (0.2 + 0.8 * pw) * Math.min(1, ng / this.ngIdle);
    let lev = st[14], quiet = st[15];
    if (!run && !sta && ng < 0.005 && np < 2 && rpm < 2) quiet += dt; else quiet = 0;
    st[15] = quiet;
    const ngRps = this.ngMax / 60;
    this.stats[3] = ng * ngRps * T[0];
    if (quiet > 1.0) {
      y0.fill(0); if (ctl) { ctl[0].fill(0); ctl[1].fill(0); }
      st[0] = 0; st[1] = 0; st[8] = st[9] = st[10] = st[11] = st[12] = st[13] = 0;
      return true;
    }
    // the roar's filters: a 1-pole pair (rumble below ~600 Hz) and a TPT band-pass at ~1.4 kHz
    const lpA = 1 - Math.exp(-PROP_TWO_PI * 600 / sr);
    const g = Math.tan(Math.PI * 1400 / sr), kq = 1 / 0.8;
    const b1 = 1 / (1 + g * (g + kq)), b2 = g * b1, b3 = g * b2;
    let lp1 = st[8], lp2 = st[9], ic1 = st[10], ic2 = st[11], dx = st[12], dy = st[13];
    let p0 = st[2], p1 = st[3], p2 = st[4], p3 = st[5], p4 = st[6];
    const m0 = T[0], m1 = T[2], m2 = T[4], m3 = T[6], m4 = T[8];
    const A0 = T[1], A1 = T[3], A2 = T[5], A3 = T[7], A4 = T[9];
    const nyq = 0.45 * sr, gain = this.gain, dcR = this.dcR;
    const kL = 1 - Math.exp(-1 / (0.1 * sr));
    let rs = this.rs[0] | 0;
    // friction and compression stop a dead turbine and its prop (an exponential's tail would turn them for ever)
    const fG = !run && !sta ? 0.02 / sr : 0, fP = !run ? 60 / sr : 0;
    for (let s = 0; s < n; s++) {
      ng += kG * (ngT - ng); np += kP * (npT - np);
      if (fG > 0 && ng > ngT) { ng -= fG; if (ng < ngT) ng = ngT; }
      if (fP > 0 && np > npT) { np -= fP; if (np < npT) np = npT; }
      lev += kL * (roarT - lev);
      const fr = ng * ngRps / sr;   // Ng revolutions per sample
      // the whine: level with Ng^2; a tone above ~0.45 sr fades out instead of folding
      const wl = ng * ng;
      let w = 0, f;
      f = fr * m0; p0 += f; if (p0 >= 1) p0 -= Math.floor(p0); if (f * sr < nyq) w += A0 * Math.sin(PROP_TWO_PI * p0) * (1 - f * sr / nyq);
      f = fr * m1; p1 += f; if (p1 >= 1) p1 -= Math.floor(p1); if (f * sr < nyq) w += A1 * Math.sin(PROP_TWO_PI * p1) * (1 - f * sr / nyq);
      f = fr * m2; p2 += f; if (p2 >= 1) p2 -= Math.floor(p2); if (f * sr < nyq) w += A2 * Math.sin(PROP_TWO_PI * p2) * (1 - f * sr / nyq);
      f = fr * m3; p3 += f; if (p3 >= 1) p3 -= Math.floor(p3); if (f * sr < nyq) w += A3 * Math.sin(PROP_TWO_PI * p3) * (1 - f * sr / nyq);
      f = fr * m4; p4 += f; if (p4 >= 1) p4 -= Math.floor(p4); if (f * sr < nyq) w += A4 * Math.sin(PROP_TWO_PI * p4) * (1 - f * sr / nyq);
      w *= 0.12 * wl;
      // the roar
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
      const nz = (2 * (rs >>> 2) * PROP_R30 - 1) * lev;
      lp1 += lpA * (nz - lp1); lp2 += lpA * (lp1 - lp2);
      const v3 = nz - ic2, v1 = b1 * ic1 + b2 * v3, v2 = ic2 + b2 * ic1 + b3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
      const x = (w + 1.6 * lp2 + 0.35 * v1) * gain;
      let y = x - dx + dcR * dy; dx = x; dy = y;
      if (y !== y) { y = 0; lp1 = lp2 = ic1 = ic2 = dx = dy = 0; ng = 0; np = 0; }
      y0[s] = y;
      if (ctl) { ctl[0][s] = ng * this.ngMax * 0.001; ctl[1][s] = np * 0.001; }
    }
    if (lp1 < 1e-20 && lp1 > -1e-20) lp1 = 0; if (lp2 < 1e-20 && lp2 > -1e-20) lp2 = 0;
    if (ic1 < 1e-20 && ic1 > -1e-20) ic1 = 0; if (ic2 < 1e-20 && ic2 > -1e-20) ic2 = 0;
    if (dx < 1e-20 && dx > -1e-20) dx = 0; if (dy < 1e-20 && dy > -1e-20) dy = 0; if (lev < 1e-20) lev = 0;
    st[0] = ng; st[1] = np; st[2] = p0; st[3] = p1; st[4] = p2; st[5] = p3; st[6] = p4;
    st[8] = lp1; st[9] = lp2; st[10] = ic1; st[11] = ic2; st[12] = dx; st[13] = dy; st[14] = lev;
    this.stats[0] = ng; this.stats[1] = np; this.stats[2] = lev;
    this.rs[0] = rs;
    return true;
  }
}

// ============================================================================
// THE ELECTRIC MOTOR (§3.4)
// ============================================================================
// The whine at the electrical frequency (pole pairs x rpm / 60): the torque
// ripple at 6 f_e (three phases), its 12 f_e and the 2 f_e magnetic hum, all
// with the current (power); the inverter's PWM: f_sw +- 2 f_e, faint, present
// whenever the controller is armed. Very quiet on purpose (§3.4: the case where
// the ambience is heard over the aeroplane).
class FlyDiyElectricProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      { name: 'rpm',     defaultValue: 0, minValue: 0, maxValue: 30000, automationRate: 'k-rate' },
      { name: 'power',   defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
      { name: 'running', defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
      { name: 'starter', defaultValue: 0, minValue: 0, maxValue: 1,     automationRate: 'k-rate' },
    ];
  }
  constructor (options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.sr = sampleRate;
    // 0 motor rpm, 1..6 phases, 7 current level, 8 armed level, 9 quiet s, 10 dc x, 11 dc y
    this.st = new Float64Array(12);
    this.stats = new Float64Array(3);   // 0 rpm, 1 f_e, 2 current
    this._build(po.config || null);
    if (po.running) this.st[0] = po.rpm > 0 ? +po.rpm * this.gear : 0;
    if (this.port) this.port.onmessage = (e) => { const m = e && e.data; if (m && m.type === 'config') this._build(m.config); };
  }
  _build (cfg) {
    const c = cfg || {};
    this.cfg = c;
    this.pp = c.polePairs > 0 ? +c.polePairs : 10;
    this.pwmHz = c.pwmHz > 0 ? +c.pwmHz : 12000;
    this.gear = c.gear > 0 ? +c.gear : 1;
    this.gain = c.gain > 0 ? +c.gain : 0.012;
    this.pwmK = c.pwm != null ? +c.pwm : 0.25;
    this.st.fill(0);
    this.dcR = 1 - PROP_TWO_PI * 5 / this.sr;
  }
  process (inputs, outputs, parameters) {
    const out0 = outputs[0];
    if (!out0 || !out0.length) return true;
    const y0 = out0[0], n = y0.length, sr = this.sr, st = this.st, P = parameters;
    const ctl = outputs.length > 1 && outputs[1] && outputs[1].length >= 2 ? outputs[1] : null;
    let rpm = P.rpm ? +P.rpm[0] : 0; if (!(rpm >= 0)) rpm = 0; else if (rpm > 30000) rpm = 30000;
    let pw = P.power ? +P.power[0] : 0; if (!(pw >= 0)) pw = 0; else if (pw > 1) pw = 1;
    const run = P.running ? P.running[0] > 0.5 : false;
    const gear = this.gear, mT = rpm * gear;
    let m = st[0], cur = st[7], arm = st[8], quiet = st[9];
    if (!run && m < 1 && mT < 1) quiet += n / sr; else quiet = 0;
    st[9] = quiet;
    if (quiet > 1.0) {
      y0.fill(0); if (ctl) { ctl[0].fill(0); ctl[1].fill(0); }
      st[0] = 0; st[7] = st[8] = st[10] = st[11] = 0;
      return true;
    }
    // a low-inertia motor follows the solver closely; unpowered it freewheels (or windmills: the solver's rpm)
    const kM = 1 - Math.exp(-1 / ((run ? 0.25 : 2.5) * sr));
    const kC = 1 - Math.exp(-1 / (0.05 * sr));
    const curT = run ? 0.12 + 0.88 * pw : 0, armT = run ? 1 : 0;
    let p1 = st[1], p2 = st[2], p3 = st[3], p4 = st[4], p5 = st[5], dx = st[10], dy = st[11];
    const pp = this.pp, fsw = this.pwmHz / sr, nyq = 0.45 * sr, gain = this.gain, pwmK = this.pwmK, dcR = this.dcR;
    for (let s = 0; s < n; s++) {
      m += kM * (mT - m); cur += kC * (curT - cur); arm += kC * (armT - arm);
      const fe = m * pp / (60 * sr);   // electrical cycles per sample
      p1 += 6 * fe; if (p1 >= 1) p1 -= Math.floor(p1);
      p2 += 12 * fe; if (p2 >= 1) p2 -= Math.floor(p2);
      p3 += 2 * fe; if (p3 >= 1) p3 -= Math.floor(p3);
      p4 += fsw + 2 * fe; if (p4 >= 1) p4 -= Math.floor(p4);
      p5 += fsw - 2 * fe; if (p5 >= 1) p5 -= Math.floor(p5);
      let w = cur * (Math.sin(PROP_TWO_PI * p1) + (12 * fe * sr < nyq ? 0.35 * Math.sin(PROP_TWO_PI * p2) : 0)
                     + 0.5 * Math.sin(PROP_TWO_PI * p3));
      if ((fsw + 2 * fe) * sr < nyq) w += pwmK * arm * (0.3 + 0.7 * cur) * (Math.sin(PROP_TWO_PI * p4) + Math.sin(PROP_TWO_PI * p5));
      const x = w * gain;
      let y = x - dx + dcR * dy; dx = x; dy = y;
      if (y !== y) { y = 0; dx = dy = 0; m = 0; }
      y0[s] = y;
      if (ctl) { ctl[0][s] = m * 0.001; ctl[1][s] = m / gear * 0.001; }
    }
    if (dx < 1e-20 && dx > -1e-20) dx = 0; if (dy < 1e-20 && dy > -1e-20) dy = 0; if (cur < 1e-20) cur = 0; if (arm < 1e-20) arm = 0;
    st[0] = m; st[1] = p1; st[2] = p2; st[3] = p3; st[4] = p4; st[5] = p5; st[7] = cur; st[8] = arm;
    st[10] = dx; st[11] = dy;
    this.stats[0] = m; this.stats[1] = m * pp / 60; this.stats[2] = cur;
    return true;
  }
}

registerProcessor('flydiy-prop', FlyDiyPropProcessor);
registerProcessor('flydiy-turbine', FlyDiyTurbineProcessor);
registerProcessor('flydiy-electric', FlyDiyElectricProcessor);

// node (the offline harness and the gate): the same classes, no second copy
if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = { FlyDiyPropProcessor, FlyDiyTurbineProcessor, FlyDiyElectricProcessor, propBesselInto,
                     PROP_NH, PROP_NS, PROP_SEC_R, PROP_SEC_T, PROP_ST, PROP_REF_MH };
}
