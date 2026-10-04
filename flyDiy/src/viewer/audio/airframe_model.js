// ============================================================
// THE AIRFRAME'S NUMBERS (G1630, SND-AIRFRAME; SOUND-2026-10-04 §3.5 / §4 / §9).
// PURE: no Web Audio, no DOM - runs in node, GATE AUDIO tests it.
//
// From the parameter block P (audio_params.js) one frame at a time, it writes
// the TARGETS of every airframe layer (the k-rate AudioParams of the worklet
// 'flydiy-airframe', airframe_worklet.js, in AF_PARAMS order) and queues the
// discrete EVENTS (touchdown per wheel, tyre chirp, suspension thump, splash,
// flap lever) into a preallocated ring. Allocation-free per frame: the state is
// typed slots (a double written into an object field is a fresh heap box -
// G1602's finding), the targets a Float32Array, the events a Float64Array.
//
//   WIND      true airspeed V: amplitude ~ (V/50)^2.5 (15 dB a doubling), the
//             band centre 250 + 28 V Hz; sideslip and the alpha past 75 % of
//             the stall add turbulence (the buffet). Exterior: the camera's
//             gentle wind. Interior: a closed cabin's muffled hiss, or - open
//             cockpit (P.s[I.open]) - the blast, ~4x the closed level.
//   GROUND    ground speed x the GROUND_SURF row under the mains (the tail when
//             only it touches) x how many wheels touch; the tailwheel rattle on
//             the rough rows; the brakes squeal at walking speed.
//   TOUCHDOWN a contact's RISING EDGE (after >= AF_TUNE.tdOffS off the ground),
//             once per wheel, severity from the sink rate just before it (the
//             lowest out.vs of the last ~0.3 s): 3 m/s = 1. A main on PAVED
//             (row 5) after >= 1 s in the air above 12 m/s CHIRPS (the wheel
//             spins up); a hard one (sev > 0.35) also THUMPS the suspension, as
//             does a load spike rolling (nz off its own mean by > 0.4).
//   WATER     floats wet (P.s[I.water]): spray hiss with speed, slaps (slow
//             and heavy in displacement, a fast chatter ON THE STEP - the
//             afterbody dry: mains wet, `tail` = 0), a SPLASH on the first
//             touch. A wheeled aeroplane in water (row 4 under a wheel, no
//             hydro): the heavy drag roar and a splash on entry.
//   STALL     alpha against P.s[I.aStall] (the build's measured stall at this
//             flap): the warning band is the last AF_TUNE.warnA rad (~4.3 deg)
//             before it, gated by airflow (55 %..85 % of the build's measured stall speed). KIND per aeroplane
//             (stallKind below): 'reed' level and pitch follow the margin (it
//             moans as it starts), 'buzzer' latches on/off, 'none' is silent.
//   MECHANISM flaps moving: an electric motor (metal + an electric system) or
//             the lever's clunk (manual: one event per start of travel);
//             creaks from nz off its mean and the control rates.
// Scheduling: every target is QUANTISED (AF_Q, at the frame's end) so a steady frame reproduces
// the last value exactly and the source schedules nothing.
// ============================================================
var AIRFRAME_MODEL = (function () {
  'use strict';
  // the worklet's k-rate params, in order (airframe_worklet.js declares the same list; GATE AUDIO compares them)
  const AF_PARAMS = ['windL', 'windF', 'windT', 'windI', 'gndL', 'gndS', 'gndV', 'tailR', 'brk',
                     'watL', 'watV', 'watStep', 'watSlap', 'watDrag', 'stall', 'stallK', 'creak', 'flapM', 'open', 'duck'];
  const T = {}; AF_PARAMS.forEach((k, i) => { T[k] = i; });
  // the quantum of each target (a steady frame lands on the same step), 0 = discrete
  const AF_Q = { windL: 0.002, windF: 10, windT: 0.02, windI: 0.002, gndL: 0.002, gndS: 0, gndV: 0.25, tailR: 0.01,
                 brk: 0.01, watL: 0.002, watV: 0.25, watStep: 0, watSlap: 0.01, watDrag: 0.01, stall: 0.01, stallK: 0,
                 creak: 0.05, flapM: 0, open: 0, duck: 0 };
  const QV = new Float64Array(AF_PARAMS.length); AF_PARAMS.forEach((k, i) => { QV[i] = AF_Q[k]; });
  // THE EVENTS: [type, severity 0..1, a, b] - a: the wheel (0 left main, 1 right main, 2 tail) / the surface; b: the surface
  const AF_EV = { TD: 1, CHIRP: 2, THUMP: 3, SPLASH: 4, LEVER: 5 };
  const AF_EV_NAMES = ['', 'touchdown', 'chirp', 'thump', 'splash', 'lever'];
  const EV_CAP = 16, EV_W = 4;
  // the per-type rate limit (s): one touchdown per wheel per 0.25 s, ...
  const AF_RATE = [0, 0.25, 0.4, 0.2, 0.3, 0.35];
  const AF_SURF_PAVED = 5, AF_SURF_WATER = 4;
  // the rough rows' tailwheel rattle (GROUND_SURF codes 0..7: grass rock scree forest water paved gravel sand)
  const AF_ROUGH = [0.5, 1.0, 0.9, 0.7, 0, 0.12, 0.8, 0.4];
  const AF_TUNE = {
    Vref: 50, windExt: 0.08, windCab: 0.1, windOpen: 0.2, windMax: 2.2,
    gnd: 0.025, gndVref: 12, wat: 0.07, drag: 0.12,
    warnA: 0.075, settleS: 1.5, flowLo: 0.55, flowSpan: 0.3, VsDef: 20, tdOffS: 0.12, tdVs: 3, chirpV: 12, chirpOffS: 1.0,
  };
  // STALL WARNING KINDS: 0 none, 1 reed (airflow-driven), 2 buzzer (electric)
  const AF_STALL = { none: 0, reed: 1, buzzer: 2 };
  // THE DECLARED TABLE (physics-inert: no solver reads any of it), on the facts the RESOLVED spec keeps (def.spec:
  // resolveSpec drops meta.class and names the material spec.material / fuselage.material). An explicit
  // spec.systems.stallWarn ('reed' | 'buzzer' | 'none') outranks it - nothing writes that field yet; an editor control may.
  //   a certified class, when the spec still carries it (n23 'Normal category', util): high wing reed, else buzzer;
  //   a METAL high wing - the Cessna archetype: the reed (the leading-edge whistle, no power needed);
  //   a METAL low / mid wing with an electric system - the Piper / Robin archetype: the vane and the electric horn;
  //   everything else - tube-and-fabric (the Cub, the ultralights), wood (the Jodel), composite, unknown: none.
  const materialOf = s => s.material || (s.fuselage && (s.fuselage.material || s.fuselage.mat)) || null;
  const elecOf = s => { const el = s.systems && s.systems.elec; return !!(el && el.battery && el.battery !== 'none'); };
  function stallKind(spec) {
    const s = spec || {}, sys = s.systems || {}, ex = sys.stallWarn;
    if (ex != null && AF_STALL[ex] != null) return { kind: AF_STALL[ex], source: 'spec.systems.stallWarn' };
    const cls = s.meta && s.meta.class, w = Array.isArray(s.wings) ? s.wings[0] : s.wings;
    const high = !!(w && w.position === 'high'), mat = materialOf(s);
    if (cls === 'n23' || cls === 'util') return { kind: high ? AF_STALL.reed : AF_STALL.buzzer, source: 'class ' + cls + (high ? ', high wing' : ', low wing') };
    if (mat === 'alloy' && high) return { kind: AF_STALL.reed, source: 'metal high wing (the Cessna archetype)' };
    if (mat === 'alloy' && elecOf(s)) return { kind: AF_STALL.buzzer, source: 'metal low wing, electric (the Piper archetype)' };
    return { kind: AF_STALL.none, source: (mat || 'unknown') + ' ' + (high ? 'high' : 'low') + ' wing: no warning' };
  }
  // electric flaps: a metal aeroplane with an electric system (the C172's motor), else the lever
  function flapsElectric(spec) {
    const s = spec || {};
    return materialOf(s) === 'alloy' && elecOf(s);
  }

  // the state: typed slots only
  const S_ = ['t', 'pm0', 'pm1', 'ptw', 'pwet', 'off0', 'off1', 'offT', 'vsMin', 'nzM', 'pde', 'pda', 'pdr', 'pflap',
              'fmov', 'buzz', 'lastSurf', 'kind', 'elec', 'first', 'pdrag', 'rate', 'grace', 'esev', 'vs0'];
  const SI = {}; S_.forEach((k, i) => { SI[k] = i; });
  function airframeState() {
    return { s: new Float64Array(S_.length), last: new Float64Array(AF_RATE.length * 3).fill(-1e9),
             tg: new Float32Array(AF_PARAMS.length), ev: new Float64Array(EV_CAP * EV_W), evN: new Int32Array(1),
             def: null, kindSource: '' };
  }
  function resolve(st, def) {
    const spec = def && def.spec, k = stallKind(spec), s = st.s;
    s.fill(0); st.last.fill(-1e9); st.tg.fill(0); st.evN[0] = 0;
    s[SI.kind] = k.kind; s[SI.elec] = flapsElectric(spec) ? 1 : 0; s[SI.first] = 1; s[SI.lastSurf] = 0;
    s[SI.off0] = s[SI.off1] = s[SI.offT] = 1e3; s[SI.nzM] = 1;
    // the build's own stall speed (measured, landing flap: the slowest it flies), for the airflow a reed or a vane needs
    const G = (def && def.params && def.params.gen) || {};
    s[SI.vs0] = G.VsFlap > 0 ? G.VsFlap : G.VsMeas > 0 ? G.VsMeas : AF_TUNE.VsDef;
    st.kindSource = k.source; st.def = def;
  }
  // (the frame calls no helper of ours with a double: one V8 declines to inline boxes every double it is passed -
  // SND-ENGINE's and SND-CORE's finding; Math.min / Math.max are inlined builtins. emit() takes doubles, but runs
  // only on an event, which posts a message anyway.)
  // an event, rate-limited per type and per key (a: the wheel for touchdowns; 0 otherwise). INTS only (type, a, b): the
  // severity rides in the typed slot s[SI.esev] (a double argument would be a box per call)
  function emit(st, type, a, b) {
    const t = st.s[SI.t], li = type * 3 + (type === AF_EV.TD ? a : 0);
    if (t - st.last[li] < AF_RATE[type]) return;
    st.last[li] = t;
    const n = st.evN[0];
    if (n >= EV_CAP) return;
    const o = n * EV_W, E = st.ev, sv = st.s[SI.esev];
    E[o] = type; E[o + 1] = sv < 0 ? 0 : sv > 1 ? 1 : sv; E[o + 2] = a; E[o + 3] = b;
    st.evN[0] = n + 1;
  }

  // THE FRAME. P: the parameter block; st: airframeState(); dt: s. The caller drains st.ev[0 .. st.evN[0]) and
  // zeroes st.evN[0]. Returns st.tg.
  function airframeStep(P, st, dt) {
    if (st.def !== P.def) resolve(st, P.def);
    const I = P.I, p = P.s, s = st.s, tg = st.tg, A = AF_TUNE;
    const h = dt > 0 && dt < 1 ? dt : 0;
    s[SI.t] += h;
    const V = p[I.V], Vg = p[I.Vg], alpha = p[I.alpha], beta = p[I.beta], vs = p[I.vs], nz = p[I.nz];
    const m0 = p[I.main0] > 0, m1 = p[I.main1] > 0, tw = p[I.tail] > 0, water = p[I.water] > 0, open = p[I.open] > 0;
    const aS = p[I.aStall];
    // the sink just before a contact: the lowest vs, relaxing toward the present at 4 m/s per s
    s[SI.vsMin] = Math.min(vs, s[SI.vsMin] + 4 * h);
    // ---- WIND ----
    const vn = Math.min(A.windMax, Math.max(0, V / A.Vref));
    const w25 = V > 2 ? vn * vn * Math.sqrt(vn) : 0;
    // the airflow a reed / a vane needs: nothing under 55 % of the build's stall speed, full from 85 % (a taxi into a
    // breeze, a seaplane's nose-high hump, never sounds it)
    const vs0 = s[SI.vs0], airflow = Math.min(1, Math.max(0, (V - A.flowLo * vs0) / (A.flowSpan * vs0)));
    const buffet = aS > 0 ? Math.min(1, Math.max(0, (alpha - 0.75 * aS) / (0.25 * aS))) * airflow : 0;
    const turb = Math.min(1, Math.max(0, Math.abs(beta) / 0.2 + buffet));
    tg[T.windL] = A.windExt * w25 * (1 + 0.3 * turb);
    tg[T.windF] = V > 2 ? 250 + 28 * Math.min(110, Math.max(0, V)) : 250;
    tg[T.windT] = turb;
    tg[T.windI] = (open ? A.windOpen : A.windCab) * w25 * (1 + 0.3 * turb);
    tg[T.open] = open ? 1 : 0;
    // ---- GROUND ----
    const surf = m0 ? p[I.surf0] : m1 ? p[I.surf1] : tw ? p[I.surfT] : -1;
    if (surf >= 0) s[SI.lastSurf] = surf;
    const onLand = !water && surf >= 0 && surf !== AF_SURF_WATER;
    const cover = ((m0 ? 1 : 0) + (m1 ? 1 : 0) + (tw ? 0.6 : 0)) / 2.6;
    const vr = Math.min(2.5, Math.max(0, Vg / A.gndVref));
    tg[T.gndL] = onLand ? A.gnd * Math.pow(vr, 1.1) * (0.5 + 0.5 * cover) : 0;
    tg[T.gndS] = s[SI.lastSurf];
    tg[T.gndV] = Math.min(60, Math.max(0, Vg));
    const ls = s[SI.lastSurf] | 0;
    tg[T.tailR] = onLand && tw ? AF_ROUGH[ls] * Math.min(1, Math.max(0, Vg / 8)) : 0;
    const brake = p[I.brake];
    tg[T.brk] = onLand && (m0 || m1) && brake > 0.2 && Vg > 0.3 && Vg < 9
      ? brake * Math.min(1, Math.max(0, Vg / 1.5)) * Math.min(1, Math.max(0, (9 - Vg) / 5)) * (ls === AF_SURF_PAVED ? 1 : 0.35) : 0;
    // ---- WATER ----
    const wet = water && (m0 || m1);
    tg[T.watL] = wet ? A.wat * Math.pow(Math.min(1.6, Math.max(0, (Vg - 1) / 18)), 1.3) : 0;
    tg[T.watV] = wet ? Math.min(40, Math.max(0, Vg)) : 0;
    tg[T.watStep] = wet && !tw && Vg > 4 ? 1 : 0;
    tg[T.watSlap] = wet ? Math.min(1, Math.max(0, 0.3 + Vg / 15)) : 0;
    const inDrag = !water && ((m0 && p[I.surf0] === AF_SURF_WATER) || (m1 && p[I.surf1] === AF_SURF_WATER) || (tw && p[I.surfT] === AF_SURF_WATER));
    tg[T.watDrag] = inDrag ? Math.min(1.2, Math.max(0, 0.25 + Vg / 12)) : 0;
    // ---- CONTACT EVENTS ----
    const first = s[SI.first] > 0;   // a new aeroplane (or a reset) starts where it stands: no event on its first frame
    // ...and one spawned ON the ground settles for AF_TUNE.settleS (the structure finds its stance, a tail taps down):
    // no contact event in that window. One spawned in the air (a placed approach) has no grace.
    if (first) s[SI.grace] = m0 || m1 || tw ? A.settleS : 0;   // (`water` alone is the floats' flag, wet or not)
    else if (s[SI.grace] > 0) s[SI.grace] = Math.max(0, s[SI.grace] - h);
    const sev = Math.min(1, Math.max(0, -s[SI.vsMin] / A.tdVs));
    if (!first && !(s[SI.grace] > 0)) {
      for (let k = 0; k < 3; k++) {
        const on = k === 0 ? m0 : k === 1 ? m1 : tw, was = (k === 0 ? s[SI.pm0] : k === 1 ? s[SI.pm1] : s[SI.ptw]) > 0;
        const off = k === 0 ? s[SI.off0] : k === 1 ? s[SI.off1] : s[SI.offT];
        if (!on || was || off < A.tdOffS) continue;
        const sk = k === 0 ? p[I.surf0] : k === 1 ? p[I.surf1] : p[I.surfT];
        if (water || sk === AF_SURF_WATER) continue;   // the water's own splash, below
        { s[SI.esev] = 0.08 + 0.92 * sev; emit(st, AF_EV.TD, k | 0, sk | 0); }
        if (sev > 0.35) { s[SI.esev] = sev; emit(st, AF_EV.THUMP, k | 0, sk | 0); }
        if (k < 2 && sk === AF_SURF_PAVED && off >= A.chirpOffS && Vg > A.chirpV)
          { s[SI.esev] = Math.min(1, Math.max(0, (Vg - A.chirpV) / 18)) * (0.5 + 0.5 * sev) + 0.1; emit(st, AF_EV.CHIRP, k | 0, sk | 0); }
      }
      if (wet && !(s[SI.pwet] > 0) && Math.min(s[SI.off0], s[SI.off1]) >= A.tdOffS)
        { s[SI.esev] = Math.min(1, Math.max(0, 0.2 + 0.6 * sev + Vg / 60)); emit(st, AF_EV.SPLASH, 0, AF_SURF_WATER); }
      if (inDrag && !(s[SI.pdrag] > 0)) { s[SI.esev] = Math.min(1, Math.max(0, 0.4 + Vg / 25)); emit(st, AF_EV.SPLASH, 1, AF_SURF_WATER); }
      // rolling: a load spike off nz's own mean
      if (onLand && Vg > 2 && Math.abs(nz - s[SI.nzM]) > 0.4) { s[SI.esev] = Math.min(0.8, Math.max(0, Math.abs(nz - s[SI.nzM]) / 1.5)); emit(st, AF_EV.THUMP, 3, ls); }
    }
    s[SI.off0] = m0 ? 0 : s[SI.off0] + h; s[SI.off1] = m1 ? 0 : s[SI.off1] + h; s[SI.offT] = tw ? 0 : s[SI.offT] + h;
    s[SI.pm0] = m0 ? 1 : 0; s[SI.pm1] = m1 ? 1 : 0; s[SI.ptw] = tw ? 1 : 0; s[SI.pwet] = wet ? 1 : 0; s[SI.pdrag] = inDrag ? 1 : 0;
    // ---- STALL ----
    const kind = s[SI.kind];
    let sw = 0;
    if (kind > 0 && aS > 0) {
      const m = (alpha - (aS - A.warnA)) / A.warnA;
      if (kind === AF_STALL.reed) sw = Math.min(1, Math.max(0, m)) * airflow;
      else {   // the vane's switch: on past 15 % of the band, off under 5 %
        if (s[SI.buzz] > 0) { if (m < 0.05 || airflow < 0.3) s[SI.buzz] = 0; }
        else if (m >= 0.15 && airflow >= 0.5) s[SI.buzz] = 1;
        sw = s[SI.buzz];
      }
    }
    tg[T.stall] = sw;
    tg[T.stallK] = kind;
    // ---- MECHANISMS ----
    const fl = p[I.flap], dfl = h > 0 ? Math.abs(fl - s[SI.pflap]) / h : 0;
    const mov = !first && dfl > 0.01;
    if (mov && !(s[SI.fmov] > 0) && !(s[SI.elec] > 0)) { s[SI.esev] = 0.7; emit(st, AF_EV.LEVER, 0, 0); }
    s[SI.fmov] = mov ? 1 : 0; s[SI.pflap] = fl;
    tg[T.flapM] = mov && s[SI.elec] > 0 ? 1 : 0;
    const rate = h > 0 ? (Math.abs(p[I.de] - s[SI.pde]) + Math.abs(p[I.da] - s[SI.pda]) + 0.5 * Math.abs(p[I.dr] - s[SI.pdr])) / h : 0;
    s[SI.rate] += (rate - s[SI.rate]) * Math.min(1, Math.max(0, h / 0.15));
    const crk = first ? 0 : Math.min(1, Math.max(0, Math.abs(nz - s[SI.nzM]) / 0.8)) * (V > 5 || onLand ? 1 : 0) + 0.3 * Math.min(1, Math.max(0, (s[SI.rate] - 0.5) / 4));
    tg[T.creak] = Math.min(1, Math.max(0, crk)) < 0.05 ? 0 : Math.min(1, Math.max(0, crk));
    s[SI.nzM] += (nz - s[SI.nzM]) * Math.min(1, Math.max(0, h / 1.0));
    s[SI.pde] = p[I.de]; s[SI.pda] = p[I.da]; s[SI.pdr] = p[I.dr];
    s[SI.first] = 0;
    // the quantum: a steady frame lands on the same step, so the source schedules nothing
    for (let i = 0; i < QV.length; i++) { const q = QV[i]; if (q > 0) tg[i] = Math.round(tg[i] / q) * q; }
    return tg;
  }

  return { airframeStep, airframeState, stallKind, flapsElectric, AF_PARAMS, AF_Q, AF_EV, AF_EV_NAMES, AF_RATE,
           AF_ROUGH, AF_TUNE, AF_STALL, EV_CAP, EV_W, T };
})();
if (typeof window !== 'undefined') window.AIRFRAME_MODEL = AIRFRAME_MODEL;
if (typeof module !== 'undefined' && module.exports) module.exports = AIRFRAME_MODEL;
