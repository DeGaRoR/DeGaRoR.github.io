// dust.js — THE DUST (DIRT-DUST, 2026-11-09): what flies off a dry strip - the clouds a take-off, a landing, a taxi and
// a run-up raise, which hang, drift with the wind, grow and thin slowly, lit by the sun.
//
// The user (9 Nov): "when it's really dry, there are huge puffs of dirt clouds which are coming out at every take-off and
// landing ... they tend to stay a long time as well and to diffuse slowly." Design and research:
// D:/Dev/flydiy-notes/DIRT-DUST-DESIGN-2026-11-09.md.
//
// THREE PARTS, one file (the water's spray split the draw from app.js's emitters; here the emitters and the integration
// are pure JS with no THREE, so a node check runs them, and app.js only gathers the aeroplane's state once a frame):
//
//   THE SYSTEM   DUST.makeSystem(tier) -> sys: two pools - PUFFS (the cloud: a mass of fine dust whose sprite radius
//                grows by turbulent diffusion, r^2 = r0^2 + 8 (K_air t + K_jet tau_j (1 - e^-t/tau_j)), so a puff is a
//                Gaussian puff of sigma = r/2 and its optical depth at the centre is its mass over pi r^2: it GROWS AND
//                THINS on its own, as the user asked; its mass settles out - the coarse share in seconds, the fine share
//                in minutes; it drifts toward the wind at its height (a log profile from the 10 m wind) and sinks toward
//                a dome on the ground) and GRIT (the thrown clods and stones: ballistic, short, dark, motion-stretched)
//                and MUD (kind 2: wet clods and brown water off a puddle - grit's law, heavier, brown).
//                Old puffs MERGE (a grid by their size: two that overlap become one with their mass and their area) so a
//                300 m take-off roll is tens of puffs, not thousands; a full pool replaces its faintest.
//   THE SOURCES  DUST.sources(sys, st, env): the physics' own numbers, never authored triggers -
//                  WHEELS   a rolling tyre on a loose surface: the mass a second goes as V^1.5 (AP-42 13.2.2's unpaved-road
//                           factor is ~linear in speed per vehicle-km, i.e. ~V^2 a second at the wheel; 1.5 holds the low
//                           end visible), x the class's fines, x the dryness; braking doubles it; grit on gravel / sand;
//                  TOUCHDOWN the spin-up skid and the sink: a burst sized by the sink speed and the ground speed;
//                  PROP     the slipstream (out.wash, the solver's own far-wake increment) as a round jet down the thrust
//                           axis, its radius growing at 8 deg and its speed falling as 1/r, meeting the ground where its
//                           lower edge does: a wall jet that lifts dust where it is over the threshold (Bagnold's u*t,
//                           raised by the soil's water - Fecan 1999); the run-up blast is this at V = 0;
//                  VORTICES under 0.7 span: the tip vortices' image-doubled ground wind, Gamma = W / (rho V pi/4 b),
//                           u = 2 Gamma / (2 pi h), lifting a low sheet out under each tip;
//                  MUD      wet ground: no dust, clods off the tyres; a puddle (DIRT-STRIP's puddleAt): brown water.
//   THE DRAW     DUST.make(THREE, sys, opts) -> { mesh, sync(camera, light), dispose() }: ONE instanced quad batch (one
//                draw), every live particle written back-to-front each frame; the puff's sprite is a sphere's column torn
//                by a baked billow noise (one 128^2 texture made here, no file); lit as dust: an albedo per class, the
//                sun through Henyey-Greenstein (g 0.6: the backlit glow), self-shadowed by its own depth, the sky's
//                hemisphere and the sunlit ground's bounce; SOFT ON THE GROUND (each corner's height over the ground at
//                its centre, interpolated: the dome meets the strip with no seam, no depth texture read) and SOFT NEAR
//                THE EYE (a puff the camera is inside fades and its quad collapses: no fragments, no full-screen layers).
//                THE OVERDRAW BUDGET: the puffs' summed screen cover (in screens) is held under the tier's - the nearest
//                fade first (the far-to-near walk sets the near-fade distance, smoothed) - the phone's cost bounded by
//                construction.
//
// Loads in node (module.exports) for GATE DUST; window.DUST in the page.
'use strict';
(function () {
  // ---- THE CLASSES: the pavement's loose looks (the runway record's `look`); index into every per-class row ----------
  // fines: the share of the class's surface that is dust-sized (the AP-42 silt content's role, normalised to dirt);
  // loose: how much grit a tyre throws; ut: the dry threshold wall-wind speed near the surface (m/s, ~10x Bagnold's u*t);
  // col: the dust's albedo (linear) - INFERRED from soil reflectance tables (dry silt ~0.3-0.45, sand ~0.4-0.55)
  const CLASSES = ['dirt', 'sand', 'gravel', 'grass', 'paved'];
  const CLS = {
    dirt:   { fines: 1.0,  loose: 0.35, ut: 4.0, col: [0.42, 0.33, 0.24] },
    sand:   { fines: 0.45, loose: 1.0,  ut: 4.5, col: [0.56, 0.47, 0.34] },
    gravel: { fines: 0.35, loose: 0.8,  ut: 5.0, col: [0.40, 0.38, 0.35] },
    grass:  { fines: 0.18, loose: 0.1,  ut: 6.0, col: [0.44, 0.39, 0.29] },
    paved:  { fines: 0.03, loose: 0.0,  ut: 9.0, col: [0.40, 0.39, 0.37] },
  };
  const MUD_COL = [0.16, 0.12, 0.085];
  // ---- THE TIERS: the pools and the overdraw budget (screens of puff cover), the longest life -------------------------
  // phone = the laptop preset's (the S20 loads it), potato beside it; the cover numbers are the frame's fill budget for
  // the dust, from the research's mobile overdraw figures (design doc section 4) - to be measured, the doc names it
  const TIERS = {
    // mergeMax (m): no merge makes a puff wider than this - a take-off's trail stays a trail (a chain of puffs), not a
    // few discs 180 m across; the phone's smaller pool takes wider ones
    phone:  { puffs: 64,  grit: 160, cover: 1.5, life: 75,  merge: 1.0, mergeMax: 30 },
    potato: { puffs: 80,  grit: 240, cover: 2.0, life: 80,  merge: 1.0, mergeMax: 28 },
    retro:  { puffs: 128, grit: 400, cover: 3.5, life: 90,  merge: 0.9, mergeMax: 24 },
    gamer:  { puffs: 192, grit: 700, cover: 6.0, life: 120, merge: 0.8, mergeMax: 20 },
  };
  const TIER_OF = { laptop: 'phone', potato: 'potato', retro: 'retro', current: 'retro', gamer: 'gamer', ultra: 'gamer' };
  // ---- THE LAWS (named constants; the design doc's section 3 carries their sources) -----------------------------------
  const L = {
    kAir: 0.28, kAirWind: 0.08,      // m^2/s: the near-surface eddy diffusivity, + per m/s of the 10 m wind (a puff r = 2 sigma ~5 m at 10 s, ~14 m at 60 s: Taylor 1921 with sigma_v ~0.5 m/s near the ground)
    // FLAT, NOT ROUND (the user, 9 Nov: "clouds should persist longer ... they instantly disappear"): a dust cloud is a
    // low layer - it spreads sideways with the surface wind's eddies and hardly grows upward (the near-ground eddies are
    // small, the air above is stable at dawn and dusk): the puff is an ellipsoid, its height rv growing by kz and capped at
    // rvMax (+ rvWind a m/s of wind, the mixing's depth), its width r by kAir. Its optical depth seen from the side is
    // m / (pi r rv), so a cloud that spreads only sideways thins as 1/r, not 1/r^2 - it HANGS, as the footage does
    kz: 0.05, kzWind: 0.02, rvMax: 4.5, rvWind: 0.5, rvCap: 9,
    jetTau: 2.0,                     // s: a source's own turbulence decays over this
    coarse: 0.35, tauCoarse: 6.0, tauFine: 240,   // the mass's two shares: 35 % settles in ~6 s, the rest over minutes (the bench, 9 Nov: 55 % / 4 s read as gone)
    domeK: 0.32,                     // the puff's centre settles at ground + domeK r (a dome: the lower part under the ground, faded)
    puffDrag: 0.55,                  // /s: a puff relaxes to the air's velocity
    gritDrag: 0.15, mudDrag: 0.05,
    z0: 0.03,                        // m: the strip's roughness length for the log wind
    // the wheels
    wheelK: 0.15, wheelV0: 2.0,      // optical m^2 a second per (m/s over V0)^2 at fines 1, dry (AP-42: per metre ~linear in speed, so ~V^2 a second;
                                     // the user, 9 Nov: "taxi should emit less dirt" - 6 m/s is a twelfth of the 20 m/s roll's)
    brakeK: 1.0,                     // + this x brake x the rolling rate
    spacing: 1.4, spacingV: 0.12, topUpAge: 0.5,   // a source tops its current puff up until it moved max(spacing, spacingV x its speed) or it is this old
    gritRate: 9,                     // grit a second per m/s at loose 1, dry (gravel and sand's rooster tail)
    // touchdown
    tdMin: 0.25, tdK: 3.0,           // m/s of sink to count; optical m^2 per (m/s sink x m/s ground speed)
    // the prop
    jetHalf: 8 * Math.PI / 180, propK: 2.4,   // (the bench, 9 Nov: x6 - a run-up's cloud ~8-10 m, as the footage)
    jetUt: 1.5,                      // the wall jet's threshold over the class's: the jet's centreline speed overstates the wind at the grains
                                     // (u* ~0.06 u); at taxi power (~9 m/s at the ground) next to nothing, a run-up (~22) a cloud
    // vortices
    vortK: 1.0,
    // fade
    tauMin: 0.003,
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rnd = Math.random;

  // ================================================================================================================
  // THE SYSTEM
  // ================================================================================================================
  function makeSystem(tierName) {
    const T = TIERS[tierName] || TIERS[TIER_OF[tierName]] || TIERS.gamer;
    const NP = T.puffs, NG = T.grit;
    const sys = {
      tier: T, tierName: TIERS[tierName] ? tierName : (TIER_OF[tierName] || 'gamer'), t: 0,
      // puffs: position, velocity, birth radius, mass at birth (optical m^2), age, jet turbulence, class, seed, gen
      P: { p: new Float32Array(NP * 3), v: new Float32Array(NP * 3), r0: new Float32Array(NP), m0: new Float32Array(NP),
           age: new Float32Array(NP).fill(-1), kj: new Float32Array(NP), cls: new Uint8Array(NP), seed: new Float32Array(NP),
           gen: new Uint32Array(NP), gy: new Float32Array(NP), r: new Float32Array(NP), tau: new Float32Array(NP), rv0: new Float32Array(NP), rv: new Float32Array(NP),
           into: new Int32Array(NP).fill(-1), intoGen: new Uint32Array(NP), mt: new Float32Array(NP), mI: new Float32Array(NP), aI: new Float32Array(NP), vI: new Float32Array(NP), n: NP, live: 0 },
      // grit + mud: position, velocity, size, age, life, kind (0 grit, 2 mud), class
      G: { p: new Float32Array(NG * 3), v: new Float32Array(NG * 3), s: new Float32Array(NG), age: new Float32Array(NG).fill(9), life: new Float32Array(NG).fill(1),
           kind: new Uint8Array(NG), cls: new Uint8Array(NG), seed: new Float32Array(NG), next: 0, n: NG, live: 0 },
      src: new Map(),      // a source's current puff: key -> { i, gen }
      genN: 1,
      wasOn: [], stats: { emitted: 0, merged: 0, absorbed: 0 }, kAir: L.kAir, kz: L.kz, rvTop: L.rvMax,
    };
    return sys;
  }
  // a free puff slot (a dead one), or -1: the pool is full
  function puffSlot(sys) {
    const P = sys.P;
    for (let i = 0; i < P.n; i++) if (P.age[i] < 0) return i;
    return -1;
  }
  // A FULL POOL TOPS UP, IT NEVER DELETES (the user, 9 Nov: "some [plumes] are coming and vanishing ... especially for the
  // heavy phases"): the new mass goes into the nearest live puff (widened by the newcomer's area) - no puff is taken away
  function absorb(sys, x, y, z, r0, m) {
    const P = sys.P;
    let best = -1, bd = Infinity;
    for (let i = 0; i < P.n; i++) { if (P.age[i] < 0 || P.into[i] >= 0) continue; const dx = P.p[i * 3] - x, dz = P.p[i * 3 + 2] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    if (best < 0) return -1;
    P.m0[best] += m / decay(P.age[best]); P.r0[best] = Math.sqrt(P.r0[best] * P.r0[best] + 0.5 * r0 * r0);
    sys.stats.absorbed++;
    return best;
  }
  // emitPuff(sys, x, y, z, vx, vy, vz, r0, m, kj, cls) -> slot
  function emitPuff(sys, x, y, z, vx, vy, vz, r0, m, kj, cls) {
    const P = sys.P, i = puffSlot(sys);
    if (i < 0) return absorb(sys, x, y, z, r0, m);
    P.p[i * 3] = x; P.p[i * 3 + 1] = y; P.p[i * 3 + 2] = z; P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
    P.r0[i] = r0; P.m0[i] = m; P.age[i] = 0; P.kj[i] = kj; P.cls[i] = cls; P.seed[i] = rnd(); P.gen[i] = sys.genN++;
    P.r[i] = r0; P.rv0[i] = r0; P.rv[i] = r0; P.tau[i] = m / (Math.PI * r0 * r0); P.gy[i] = y; P.into[i] = -1;
    sys.stats.emitted++;
    return i;
  }
  // a source's puff, topped up while it is young and near, else a new one (the source's handle follows it)
  function sourcePuff(sys, key, x, y, z, vx, vy, vz, r0, dm, kj, cls) {
    const P = sys.P, h = sys.src.get(key);
    if (h && P.gen[h.i] === h.gen && P.age[h.i] >= 0 && P.age[h.i] < L.topUpAge && P.cls[h.i] === cls && P.into[h.i] < 0) {
      const i = h.i, dx = P.p[i * 3] - x, dz = P.p[i * 3 + 2] - z;
      const sp = Math.max(L.spacing, L.spacingV * Math.hypot(vx, vz) / 0.3);   // (vx, vz: the puff's launch, 0.3 of the source's speed)
      if (dx * dx + dz * dz < sp * sp) {
        // mass in at the source's point: the centre moves toward it by the mass share, the velocity mixes
        const m = curMass(P, i), w = dm / Math.max(1e-6, m + dm);
        P.p[i * 3] += (x - P.p[i * 3]) * w; P.p[i * 3 + 2] += (z - P.p[i * 3 + 2]) * w; P.p[i * 3 + 1] += (y - P.p[i * 3 + 1]) * w;
        P.v[i * 3] += (vx - P.v[i * 3]) * w; P.v[i * 3 + 1] += (vy - P.v[i * 3 + 1]) * w; P.v[i * 3 + 2] += (vz - P.v[i * 3 + 2]) * w;
        P.m0[i] += dm / decay(P.age[i]); P.kj[i] = Math.max(P.kj[i], kj);
        return i;
      }
    }
    const i = emitPuff(sys, x, y, z, vx, vy, vz, r0, dm, kj, cls);
    if (i < 0) return i;
    if (h) { h.i = i; h.gen = P.gen[i]; } else sys.src.set(key, { i, gen: P.gen[i] });
    return i;
  }
  const decay = t => L.coarse * Math.exp(-t / L.tauCoarse) + (1 - L.coarse) * Math.exp(-t / L.tauFine);
  const curMass = (P, i) => P.m0[i] * decay(P.age[i]);
  function emitGrit(sys, kind, x, y, z, vx, vy, vz, s, cls) {
    const G = sys.G, q = G.next; G.next = (G.next + 1) % G.n;
    G.p[q * 3] = x; G.p[q * 3 + 1] = y; G.p[q * 3 + 2] = z; G.v[q * 3] = vx; G.v[q * 3 + 1] = vy; G.v[q * 3 + 2] = vz;
    G.s[q] = s; G.age[q] = 0; G.life[q] = kind === 2 ? 1.6 : 1.2; G.kind[q] = kind; G.cls[q] = cls; G.seed[q] = rnd();
  }
  // the wind at height y over the ground: the 10 m wind on a log profile
  const LOG10 = Math.log(10 / L.z0);
  function windAt(env, hAgl, out) {
    const w = env.wind ? env.wind() : null;
    const k = Math.log(Math.max(L.z0 * 1.5, hAgl) / L.z0) / LOG10;
    out[0] = w ? w[0] * k : 0; out[1] = w ? w[1] * k : 0; out[2] = w ? (w[2] != null ? w[2] : Math.hypot(w[0], w[1])) : 0;
    return out;
  }
  // ---- step(sys, dt, env): integrate both pools, merge the old puffs ---------------------------------------------
  const WV = [0, 0, 0];
  const MERGE = new Map();
  function step(sys, dt, env) {
    if (!(dt > 0)) return;
    sys.t += dt;
    const P = sys.P, T = sys.tier, gH = env.groundH;
    const w10 = env.wind ? env.wind() : null, spd10 = w10 ? (w10[2] != null ? w10[2] : Math.hypot(w10[0], w10[1])) : 0;
    const kAir = sys.kAir = L.kAir + L.kAirWind * spd10, kz = sys.kz = L.kz + L.kzWind * spd10;
    const rvTop = sys.rvTop = Math.min(L.rvCap, L.rvMax + L.rvWind * spd10);
    let live = 0;
    for (let i = 0; i < P.n; i++) {
      if (P.age[i] < 0) continue;
      const a = P.age[i] += dt;
      if (P.into[i] >= 0) handOver(sys, i, dt);
      if (P.age[i] < 0) continue;
      const jt = P.kj[i] * L.jetTau * (1 - Math.exp(-a / L.jetTau));
      const r2 = P.r0[i] * P.r0[i] + 8 * (kAir * a + jt);
      const r = P.r[i] = Math.sqrt(r2);
      const rv = P.rv[i] = Math.min(r, rvTop, Math.sqrt(P.rv0[i] * P.rv0[i] + 8 * (kz * a + 0.35 * jt)));
      const tau = P.tau[i] = curMass(P, i) / (Math.PI * r * rv) * lifeFade(a, T.life);
      if (tau < L.tauMin && a > 1) { if (P.into[i] >= 0) { P.into[i] = -1; sys.stats.merged++; } P.age[i] = -1; continue; }
      live++;
      const x = P.p[i * 3], z = P.p[i * 3 + 2];
      const g = gH ? gH(x, z) : 0;
      P.gy[i] = g;
      const hc = Math.max(0.2, P.p[i * 3 + 1] - g);
      windAt(env, hc, WV);
      const dr = Math.min(1, L.puffDrag * dt);
      P.v[i * 3] += (WV[0] - P.v[i * 3]) * dr;
      P.v[i * 3 + 2] += (WV[1] - P.v[i * 3 + 2]) * dr;
      // the vertical: its own momentum dies, and the centre settles toward the dome's (ground + domeK rv)
      const yT = g + L.domeK * rv;
      P.v[i * 3 + 1] += (-(P.p[i * 3 + 1] - yT) * 0.4 - P.v[i * 3 + 1]) * dr;
      P.p[i * 3] += P.v[i * 3] * dt; P.p[i * 3 + 1] += P.v[i * 3 + 1] * dt; P.p[i * 3 + 2] += P.v[i * 3 + 2] * dt;
      if (P.p[i * 3 + 1] < g) P.p[i * 3 + 1] = g;
    }
    P.live = live;
    mergeOld(sys);
    // grit and mud: ballistic with a little drag, dead on the ground
    const G = sys.G;
    let gl = 0;
    for (let q = 0; q < G.n; q++) {
      if (G.age[q] >= G.life[q]) continue;
      G.age[q] += dt;
      const dr = 1 - (G.kind[q] === 2 ? L.mudDrag : L.gritDrag) * dt;
      G.v[q * 3] *= dr; G.v[q * 3 + 2] *= dr; G.v[q * 3 + 1] = G.v[q * 3 + 1] * dr - 9.81 * dt;
      G.p[q * 3] += G.v[q * 3] * dt; G.p[q * 3 + 1] += G.v[q * 3 + 1] * dt; G.p[q * 3 + 2] += G.v[q * 3 + 2] * dt;
      if (G.age[q] > 0.05 && G.v[q * 3 + 1] < 0 && G.p[q * 3 + 1] < (gH ? gH(G.p[q * 3], G.p[q * 3 + 2]) : 0)) { G.age[q] = G.life[q]; continue; }
      gl++;
    }
    G.live = gl;
  }
  // the last fifth of the tier's life fades the puff out (a hard cap on what a pool holds; the mass law fades it first)
  const lifeFade = (a, life) => 1 - smooth(0.8 * life, life, a);
  // MERGE: puffs past 1.5 s, hashed on a grid sized by their radius band; a puff whose cell holds an older one it overlaps
  // by more than `merge` of their radii's sum joins it - the mass summed, the area summed (r^2 = r1^2 + r2^2 keeps the
  // optical depth of the pair's mean), the height the taller's. NOT AT ONCE (the user, 9 Nov: the puffs "coming and
  // vanishing"): a HAND-OVER over MERGE_T - the joining puff gives its mass and its area to the other a little each frame,
  // drifting toward it, fading as it empties; the other grows as it fills. Nothing pops.
  const MERGE_T = 1.5;
  function handOver(sys, i, dt) {
    const P = sys.P, j = P.into[i];
    if (P.age[j] < 0 || P.gen[j] !== P.intoGen[i] || P.into[j] >= 0) { P.into[i] = -1; return; }   // the other is gone or busy: carry on alone
    const df = Math.min(dt / MERGE_T, 1 - P.mt[i]);
    P.mt[i] += df;
    const dm = df * P.mI[i];
    P.m0[i] = Math.max(0, P.m0[i] - dm / decay(P.age[i]));
    P.m0[j] += dm / decay(P.age[j]);
    P.r0[j] = Math.sqrt(P.r0[j] * P.r0[j] + df * P.aI[i]);
    const rvj = P.rv[j]; if (P.vI[i] > rvj) P.rv0[j] = Math.sqrt(P.rv0[j] * P.rv0[j] + df * (P.vI[i] * P.vI[i] - rvj * rvj));
    const k = Math.min(1, dt * 0.8);
    for (let c = 0; c < 3; c += 2) P.p[i * 3 + c] += (P.p[j * 3 + c] - P.p[i * 3 + c]) * k;
    if (P.mt[i] >= 0.999) { P.age[i] = -1; P.into[i] = -1; sys.stats.merged++; }
  }
  function mergeOld(sys) {
    const P = sys.P, k = sys.tier.merge;
    MERGE.clear();
    for (let i = 0; i < P.n; i++) {
      const a = P.age[i];
      if (a < 1.5 || P.into[i] >= 0) continue;
      const r = P.r[i], band = r < 3 ? 0 : r < 8 ? 1 : 2, cs = band === 0 ? 3 : band === 1 ? 8 : 20;
      const key = band * 1e8 + Math.floor(P.p[i * 3] / cs) * 1e4 + Math.floor(P.p[i * 3 + 2] / cs);
      const j = MERGE.get(key);
      if (j == null) { MERGE.set(key, i); continue; }
      const dx = P.p[i * 3] - P.p[j * 3], dz = P.p[i * 3 + 2] - P.p[j * 3 + 2], d = Math.hypot(dx, dz);
      if (d > k * 0.5 * (r + P.r[j]) || r * r + P.r[j] * P.r[j] > sys.tier.mergeMax * sys.tier.mergeMax || P.into[j] >= 0) continue;
      // i hands over to j (the elder or the first in the cell): its mass, its area, its height, over MERGE_T
      P.into[i] = j; P.intoGen[i] = P.gen[j]; P.mt[i] = 0; P.mI[i] = curMass(P, i); P.aI[i] = P.r[i] * P.r[i]; P.vI[i] = P.rv[i];
      MERGE.delete(key);
    }
  }

  // ================================================================================================================
  // THE SOURCES - st: the aeroplane this frame (app.js gathers it), env: the world's queries
  //   st.wheels [{ x, y, z (the contact, on the ground), vx, vy, vz (the axle's), on, R (tyre radius m), brake 0..1, key }]
  //   st.props  [{ x, y, z (the disc's centre), ax, ay, az (the thrust's unit vector, forward), R (disc radius), wash }]
  //   st.wing   { span, W (weight N), V (true airspeed), rho, tips: [[x, y, z], [x, y, z]], fwd: [fx, fz] }
  //   env       groundH(x, z), wind() -> [wx, wz, spd], cls(x, z) -> class index or -1, wet(clsIdx) -> S 0..1,
  //             puddle(x, z) -> m of standing water, k (a global dust dial, 1)
  // ================================================================================================================
  // the dryness: the soil's water against the dust (Fecan 1999: the threshold rises steeply past the residual water);
  // 1 dry, 0 none. And the threshold's factor for a wall wind.
  const dryK = S => 1 - smooth(0.08, 0.38, S);
  const utK = S => Math.sqrt(1 + 1.21 * Math.pow(Math.max(0, S - 0.05) * 30, 0.68));
  function sources(sys, st, env, dt) {
    if (!(dt > 0)) return;
    const K = env.k != null ? env.k : 1;
    // ---- the wheels ----
    const W = st.wheels || [];
    for (let k = 0; k < W.length; k++) {
      const w = W[k], key = 'w' + (w.key != null ? w.key : k);
      const was = sys.wasOn[k]; sys.wasOn[k] = !!w.on;
      if (!w.on) continue;
      const ci = env.cls ? env.cls(w.x, w.z) : 0;
      if (ci < 0) continue;
      const C = CLS[CLASSES[ci]], S = env.wet ? env.wet(ci) : 0, dry = dryK(S), V = Math.hypot(w.vx, w.vz);
      const pud = env.puddle ? env.puddle(w.x, w.z) : 0, mud = smooth(0.45, 0.8, S);
      const g = w.y;
      // TOUCHDOWN: the contact begins with a sink - the spin-up skid scrubs, the tyre slaps the ground
      if (!was && -w.vy > L.tdMin && V > 3) {
        const vs = -w.vy, m = L.tdK * vs * V * C.fines * dry * K;
        if (m > 0.002) for (let j = 0; j < 4; j++) {
          const a = rnd() * 6.2832, out = (0.6 + 0.8 * rnd()) * Math.min(3, vs);
          emitPuff(sys, w.x + Math.cos(a) * 0.3, g + 0.2, w.z + Math.sin(a) * 0.3, w.vx * 0.35 + Math.cos(a) * out, 0.4 + 0.5 * vs, w.vz * 0.35 + Math.sin(a) * out,
            0.35 + 0.1 * vs, m / 4, 0.6 + 0.4 * vs, ci);
        }
        const ng = Math.round(Math.min(40, 8 * vs * (C.loose * dry + mud)));
        for (let j = 0; j < ng; j++) { const a = rnd() * 6.2832, sp = (0.5 + 1.5 * rnd()) * Math.min(2.5, vs);
          emitGrit(sys, dry < 0.5 ? 2 : 0, w.x, g + 0.05, w.z, w.vx * 0.4 + Math.cos(a) * sp, 0.8 + 1.6 * rnd() * Math.min(2, vs), w.vz * 0.4 + Math.sin(a) * sp, 0.012 + 0.02 * rnd(), ci); }
        if (pud > 0.01) splash(sys, w, pud, Math.max(vs, 1), V, ci);
      }
      if (V < 0.8) continue;
      // ROLLING: the dust behind the tyre, up off the tread - a puff topped up along the track
      const vv = Math.max(0, V - L.wheelV0), rate = (L.wheelK * vv * vv * (1 + L.brakeK * (w.brake || 0)) * C.fines * dry * K) * (pud > 0.01 ? 0 : 1);
      if (rate > 1e-4) {
        const ux = w.vx / V, uz = w.vz / V;
        sourcePuff(sys, key, w.x - ux * (w.R || 0.2), g + (w.R || 0.2) * 0.8, w.z - uz * (w.R || 0.2), w.vx * 0.3 + (rnd() - 0.5) * 0.6, 0.5 + 0.5 * rnd() + 0.03 * V,
          w.vz * 0.3 + (rnd() - 0.5) * 0.6, 0.25 + 0.012 * V, rate * dt, 0.25 + 0.03 * V, ci);
      }
      // GRIT (dry, loose) and MUD (wet): thrown off the tread, back and up
      const gr = L.gritRate * V * (C.loose * dry * 0.6 + mud * 0.8) * K * dt;
      let ng = Math.floor(gr); if (rnd() < gr - ng) ng++;
      for (let j = 0; j < ng; j++) {
        const kind = dry < 0.5 ? 2 : 0, sp = rnd();   // past the dust's threshold of water, what flies off is mud
        emitGrit(sys, kind, w.x, g + 0.05 + 0.2 * rnd() * (w.R || 0.2), w.z, w.vx * (0.25 + 0.35 * sp) + (rnd() - 0.5) * 1.2, (0.4 + 0.8 * rnd()) * Math.min(4, 0.25 * V + 0.5),
          w.vz * (0.25 + 0.35 * sp) + (rnd() - 0.5) * 1.2, kind === 2 ? 0.015 + 0.02 * rnd() : 0.006 + 0.012 * rnd(), ci);
      }
      // a PUDDLE: the tyre parts the water - brown water thrown out both sides and up
      if (pud > 0.01 && V > 2) { const n = Math.min(12, V * 0.6 * Math.min(1, pud / 0.04)) * dt * 3; for (let j = 0; j < n; j++) splashDrop(sys, w, V, ci); }
    }
    // ---- the props: the slipstream's wall jet ----
    const PR = st.props || [];
    for (let k = 0; k < PR.length; k++) propJet(sys, PR[k], 'p' + k, env, dt, K);
    // ---- the vortices: low over the ground, the tip vortices' ground wind ----
    if (st.wing && st.wing.tips && st.wing.V > 8) vortices(sys, st.wing, env, dt, K);
  }
  function splash(sys, w, depth, vs, V, ci) {
    const n = Math.round(Math.min(50, 10 * vs * Math.min(1, depth / 0.03)));
    for (let j = 0; j < n; j++) { const a = rnd() * 6.2832, sp = (0.8 + 2 * rnd()) * Math.min(2.5, vs);
      emitGrit(sys, 2, w.x, w.y + 0.05, w.z, w.vx * 0.4 + Math.cos(a) * sp, 1 + 2.2 * rnd() * Math.min(2, vs), w.vz * 0.4 + Math.sin(a) * sp, 0.01 + 0.02 * rnd(), ci); }
  }
  function splashDrop(sys, w, V, ci) {
    const ux = w.vx / V, uz = w.vz / V, side = rnd() < 0.5 ? -1 : 1, so = (0.15 + 0.25 * rnd()) * V;
    emitGrit(sys, 2, w.x, w.y + 0.05, w.z, w.vx * 0.3 - uz * side * so, (0.15 + 0.2 * rnd()) * V, w.vz * 0.3 + ux * side * so, 0.008 + 0.015 * rnd(), ci);
  }
  // THE PROP'S JET: a round jet from the disc down the thrust axis (aft), radius R + s tan(8 deg), speed wash R / r(s)
  // (a round jet's momentum held); where its lower edge meets the ground (s_hit) the wall jet scours if it is over the
  // threshold: the flux goes as u (u^2 - u_t^2) (Owen's saltation flux's form), its dust a puff thrown aft and spread
  function propJet(sys, pr, key, env, dt, K) {
    const wash = pr.wash || 0;
    if (wash < 2) return;
    const gH = env.groundH, g0 = gH ? gH(pr.x, pr.z) : 0, h = pr.y - g0, R = pr.R || 0.9;
    const ax = -pr.ax, ay = -pr.ay, az = -pr.az;             // the jet runs aft
    const tn = Math.tan(L.jetHalf), down = -ay + tn;
    if (down <= 0.01) return;
    const sHit = Math.max(0, (h - R) / down);
    if (sHit > 40) return;
    const rS = R + sHit * tn, u = wash * R / rS * 0.85;
    const hx = pr.x + ax * sHit, hz = pr.z + az * sHit;
    const ci = env.cls ? env.cls(hx, hz) : 0;
    if (ci < 0) return;
    const C = CLS[CLASSES[ci]], S = env.wet ? env.wet(ci) : 0, ut = C.ut * L.jetUt * utK(S);
    if (u <= ut || (env.puddle && env.puddle(hx, hz) > 0.01)) return;
    const flux = u * (u * u - ut * ut) / (ut * ut * ut);      // dimensionless, 0 at the threshold
    const rate = L.propK * flux * C.fines * dryK(S) * K;
    if (rate < 1e-4) return;
    const hl = Math.hypot(ax, az) || 1, fx = ax / hl, fz = az / hl;
    const lat = (rnd() - 0.5) * 2 * rS;
    const gy = gH ? gH(hx, hz) : g0;
    sourcePuff(sys, key + (lat < 0 ? 'l' : 'r'), hx - fz * lat * 0.5, gy + 0.3, hz + fx * lat * 0.5, fx * u * 0.55 - fz * lat * 0.3, 0.6 + 0.6 * rnd(), fz * u * 0.55 + fx * lat * 0.3,
      0.45 + 0.25 * rS, rate * dt, 0.6 + 0.05 * u, ci);
    // the blast's grit: stones and clods thrown aft along the ground
    const gr = 2.5 * flux * C.loose * dryK(S) * K * dt;
    let ng = Math.floor(gr); if (rnd() < gr - ng) ng++;
    for (let j = 0; j < ng; j++) emitGrit(sys, 0, hx + (rnd() - 0.5) * rS, gy + 0.05, hz + (rnd() - 0.5) * rS, fx * u * (0.3 + 0.4 * rnd()), 0.5 + 1.5 * rnd(), fz * u * (0.3 + 0.4 * rnd()), 0.005 + 0.01 * rnd(), ci);
  }
  // THE TIP VORTICES near the ground: each tip's vortex at height h, its image under the ground doubling the wind along it:
  // u = Gamma / (pi h); Gamma = W / (rho V (pi/4) b). Over the threshold a low sheet of dust goes out sideways under the tip
  function vortices(sys, wg, env, dt, K) {
    const b = wg.span || 10, gam = wg.W / ((wg.rho || 1.225) * wg.V * 0.785 * b);
    for (let s = 0; s < 2; s++) {
      const tp = wg.tips[s], gH = env.groundH, g = gH ? gH(tp[0], tp[2]) : 0, h = tp[1] - g;
      if (h > 0.7 * b || h < 0.1) continue;
      const u = gam / (Math.PI * Math.max(0.5, h));
      const ci = env.cls ? env.cls(tp[0], tp[2]) : 0;
      if (ci < 0) continue;
      const C = CLS[CLASSES[ci]], S = env.wet ? env.wet(ci) : 0, ut = C.ut * utK(S);
      if (u <= ut) continue;
      const flux = u * (u * u - ut * ut) / (ut * ut * ut);
      const rate = L.vortK * flux * C.fines * dryK(S) * K;
      if (rate < 1e-4) continue;
      // outward: away from the other tip
      const o = wg.tips[1 - s], ox = tp[0] - o[0], oz = tp[2] - o[2], on = Math.hypot(ox, oz) || 1;
      sourcePuff(sys, 'v' + s, tp[0], g + 0.3, tp[2], ox / on * u * 0.4, 0.3, oz / on * u * 0.4, 0.6, rate * dt, 0.4, ci);
    }
  }

  // ================================================================================================================
  // THE DRAW
  // ================================================================================================================
  const VERT = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iA;   // iA: age01, size (m), seed, kind (1 puff, 0 grit, 2 mud)
    attribute vec4 iB;                                              // iB: optical depth at the centre, ground y, class, a puff's half-height
    uniform float uStretch, uMinNdc, uNear;
    uniform vec3 uCol[5]; uniform vec3 uMud;
    varying vec2 vUv; varying vec4 vA; varying vec3 vCol; varying float vTau, vGd, vK, vSv;
    void main() {
      vUv = uv; vA = iA;
      vec4 vp = modelViewMatrix * vec4(iPos, 1.0);
      float s = iA.y, kind = iA.w, dist = -vp.z;
      bool puff = kind > 0.5 && kind < 1.5;
      float sv = puff ? iB.w : s;                                   // the puff's half-height (an ellipsoid: wide and low)
      vSv = sv;
      // SOFT NEAR THE EYE: a puff the camera is INSIDE (or the budget's near fade) - faded, then its quad collapsed (no fragments)
      float nlo = max(uNear, 0.35 * s);
      float nf = puff ? smoothstep(nlo, nlo + 0.6 * s + 1.0, dist) : 1.0;
      vTau = iB.x * nf;
      if (vTau < 0.002 || dist < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
      float sp = length(vv.xy);
      vec2 ax = sp > 0.05 ? vv.xy / sp : vec2(1.0, 0.0), ay = vec2(-ax.y, ax.x);
      // a grit speck is held at ~1 px and its alpha carries its area (spray.js's law)
      float ndc = s * projectionMatrix[1][1] / max(0.05, dist);
      vK = 1.0;
      if (kind < 0.5 || kind > 1.5) { if (ndc < uMinNdc && ndc > 0.0) { vK = max(0.1, (ndc / uMinNdc) * (ndc / uMinNdc)); s *= uMinNdc / ndc; } }
      float len = s + (puff ? 0.0 : min(0.5, sp * uStretch)), hy = s;
      if (puff) {
        // the ellipsoid's outline: its height along the world's up as the eye sees it, its width across (seen from above: round)
        vec2 up = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xy;
        float ku = length(up);
        ay = ku > 0.01 ? up / ku : vec2(0.0, 1.0); ax = vec2(ay.y, -ay.x);
        hy = mix(s, sv, clamp(ku, 0.0, 1.0));
      }
      vec2 c = uv - 0.5;
      vec2 off = ax * c.x * len * 2.0 + ay * c.y * hy * 2.0;
      vp.xy += off;
      // SOFT ON THE GROUND: this corner's height over the ground (the view offset turned back to the world: the view
      // matrix's rotation transposed); linear over the quad, so the fragment's is exact for a flat ground under the puff
      vec3 wOff = vec3(off, 0.0) * mat3(viewMatrix);
      vGd = iPos.y + wOff.y - iB.y;
      int ci = int(iB.z + 0.5);
      vCol = kind > 1.5 ? uMud : ci == 0 ? uCol[0] : ci == 1 ? uCol[1] : ci == 2 ? uCol[2] : ci == 3 ? uCol[3] : uCol[4];
      gl_Position = projectionMatrix * vp;
      #include <logdepthbuf_vertex>
    }`;
  const FRAG = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec2 vUv; varying vec4 vA; varying vec3 vCol; varying float vTau, vGd, vK, vSv;
    uniform sampler2D uNoise;
    uniform vec3 uSunV, uSunCol, uSkyCol, uGndCol; uniform float uOpacity, uG;
    void main() {
      #include <logdepthbuf_fragment>
      vec2 q = vUv * 2.0 - 1.0;
      float d2 = dot(q, q);
      if (d2 > 1.0) discard;
      float age = vA.x, s = vA.y, seed = vA.z, kind = vA.w;
      vec3 col; float a;
      if (kind > 0.5 && kind < 1.5) {
        // THE PUFF: a sphere's column, torn by the billow (two taps of the baked noise: density r, its normal gb)
        vec2 o = vec2(seed * 7.13, seed * 3.71) + vec2(age * 0.06, -age * 0.09);
        vec4 n1 = texture2D(uNoise, vUv * 0.6 + o);
        vec4 n2 = texture2D(uNoise, vUv * 1.45 + o.yx * 1.7 + 0.37);
        float n = n1.r * 0.62 + n2.r * 0.38;
        float th = sqrt(1.0 - d2);
        float dens = th * smoothstep(0.18, 0.8, n * (0.45 + 0.55 * th) + 0.3 * th);
        float tau = vTau * dens * 2.0;
        a = 1.0 - exp(-tau);
        a *= smoothstep(-0.05 * vSv, 0.3 * vSv + 0.15, vGd);      // soft on the ground
        a *= smoothstep(0.0, 0.04, age);                           // born over a moment
        // lit as dust: the sphere's normal bent by the billow's
        vec3 N = normalize(vec3(q + (n1.gb * 2.0 - 1.0) * 0.7, th * 0.9 + 0.1));
        float ndl = dot(N, uSunV);
        // self-shadow: the dark side of a thick puff loses some sun (the depth the light crosses), a thin one is lit through;
        // dust is a bright scatterer (albedo ~0.95), so the light that crosses it forward still reaches the eye - the backlit
        // glow is the forward lobe below, only softened by the thickness (the bench, 9 Nov: a full shadow made backlit dust dark)
        float thick = clamp(vTau * 0.5, 0.0, 0.6);
        float sh = mix(1.0, smoothstep(-0.8, 0.6, ndl), thick);
        // Henyey-Greenstein toward the eye (V = +z in view): forward scatter when the sun is behind the dust; multiple
        // scattering in a thick puff flattens the lobe
        float cs = -uSunV.z, g = uG;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cs, 1.5);
        float ph = min(4.0, mix(hg, 1.0, clamp(vTau * 0.35, 0.0, 0.8)));
        float sky = 0.75 + 0.25 * N.y;
        float fwd = max(0.0, ph - 1.0);                            // the forward excess: through the puff, not off its lit side
        col = vCol * (uSunCol * (sh * (0.55 + 0.45 * max(0.0, ndl * 0.5 + 0.5)) + fwd * (1.0 - 0.4 * thick)) + uSkyCol * sky + uGndCol * 0.35 * (1.0 - N.y * 0.5)) / 3.14159265;
      } else {
        // GRIT / MUD: a small dark clump
        float disc = smoothstep(1.0, 0.3, d2);
        a = disc * (kind > 1.5 ? 0.9 : 0.8) * vK * (1.0 - smoothstep(0.75, 1.0, age));
        float ndl = dot(normalize(vec3(q, sqrt(max(0.0, 1.0 - d2)))), uSunV) * 0.5 + 0.5;
        col = vCol * (kind > 1.5 ? 1.0 : 0.7) * (uSunCol * (0.2 + 0.8 * ndl) + uSkyCol) / 3.14159265;
        if (kind > 1.5) col += uSunCol * 0.08 * pow(max(0.0, ndl), 12.0);   // a wet glint
      }
      a *= uOpacity;
      if (a < 0.004) discard;
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // THE BILLOW TEXTURE: 128^2, tileable - fbm of value noise (four octaves) lifted by an inverted cellular term (the
  // rounded lobes of a dust cloud's edge), and the gradient's normal in g, b. Made once, here (no file, nothing to credit).
  function billow(N) {
    N = N || 128;
    const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y, P, s) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const h = (a, b) => hsh(((a % P) + P) % P, ((b % P) + P) % P, s);
      return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy; };
    const cell = (x, y, P, s) => { const ix = Math.floor(x), iy = Math.floor(y); let d = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = ix + i, cy = iy + j, wx = ((cx % P) + P) % P, wy = ((cy % P) + P) % P;
        const px = cx + hsh(wx, wy, s), py = cy + hsh(wx, wy, s + 7); d = Math.min(d, (px - x) * (px - x) + (py - y) * (py - y)); }
      return Math.sqrt(d); };
    const D = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let f = 0, amp = 0.5, fr = 4;
      for (let o = 0; o < 4; o++) { f += amp * vn(u * fr, v * fr, fr, 11 + o); amp *= 0.5; fr *= 2; }
      const c = 1 - Math.min(1, cell(u * 6, v * 6, 6, 3) * 1.1);
      D[y * N + x] = clamp(0.55 * f / 0.9375 + 0.45 * c, 0, 1);
    }
    const out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = D[y * N + x], gx = D[y * N + ((x + 1) % N)] - D[y * N + ((x + N - 1) % N)], gy = D[((y + 1) % N) * N + x] - D[((y + N - 1) % N) * N + x];
      const k = (y * N + x) * 4;
      out[k] = Math.round(d * 255); out[k + 1] = Math.round(clamp(0.5 - gx * 4, 0, 1) * 255); out[k + 2] = Math.round(clamp(0.5 - gy * 4, 0, 1) * 255); out[k + 3] = 255;
    }
    return { data: out, N };
  }
  // make(THREE, sys) -> { mesh, sync(camera, light), dispose() } - light: { sun: [x, y, z] (world, toward the sun), sunCol, skyCol, gndCol } (THREE.Colors)
  function make(THREE, sys, opts) {
    opts = opts || {};
    const n = sys.P.n + sys.G.n;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.setIndex(base.getIndex()); g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    const aP = new THREE.InstancedBufferAttribute(pos, 3), aV = new THREE.InstancedBufferAttribute(vel, 3), aA = new THREE.InstancedBufferAttribute(A, 4), aB = new THREE.InstancedBufferAttribute(B, 4);
    for (const at of [aP, aV, aA, aB]) at.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', aP); g.setAttribute('iVel', aV); g.setAttribute('iA', aA); g.setAttribute('iB', aB);
    g.instanceCount = 0;
    const bt = billow(128), tex = new THREE.DataTexture(bt.data, bt.N, bt.N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    const colV = CLASSES.map(k => new THREE.Vector3(CLS[k].col[0], CLS[k].col[1], CLS[k].col[2]));
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      uniforms: { uStretch: { value: 0.03 }, uMinNdc: { value: 0.0019 }, uNear: { value: 0 }, uCol: { value: colV }, uMud: { value: new THREE.Vector3(MUD_COL[0], MUD_COL[1], MUD_COL[2]) },
        uNoise: { value: tex }, uSunV: { value: new THREE.Vector3(0, 0, 1) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) },
        uGndCol: { value: new THREE.Color(0.2, 0.18, 0.14) }, uOpacity: { value: 1 }, uG: { value: 0.6 } } });
    mat.toneMapped = true; mat.name = 'dust';
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.name = 'dust';
    const sunW = new THREE.Vector3();
    // the sort: live puffs and grit by their view depth, far first
    const keyD = new Float32Array(n), idx = new Uint32Array(n), order = [];
    let nearS = 0;
    const api = {
      mesh, material: mat, sys, cover: 0, drawn: 0,
      sync(camera, light) {
        const P = sys.P, G = sys.G, e = camera.matrixWorldInverse.elements, pm = camera.projectionMatrix.elements, p00 = pm[0], p11 = pm[5];
        let m = 0;
        for (let i = 0; i < P.n; i++) if (P.age[i] >= 0 && P.tau[i] >= L.tauMin) {
          const x = P.p[i * 3], y = P.p[i * 3 + 1], z = P.p[i * 3 + 2];
          keyD[m] = -(e[2] * x + e[6] * y + e[10] * z + e[14]); idx[m++] = i;
        }
        const nP = m;
        for (let q = 0; q < G.n; q++) if (G.age[q] < G.life[q]) {
          const x = G.p[q * 3], y = G.p[q * 3 + 1], z = G.p[q * 3 + 2];
          keyD[m] = -(e[2] * x + e[6] * y + e[10] * z + e[14]); idx[m++] = P.n + q;
        }
        order.length = m;
        for (let k = 0; k < m; k++) order[k] = k;
        order.sort((a, b) => keyD[b] - keyD[a]);
        // THE OVERDRAW BUDGET: far to near, the puffs' screen cover summed (screens); past the tier's, the near fade
        // moves out to there - smoothed, so a moving eye does not pop the near puffs
        let cov = 0, nearT = 0;
        const covMax = sys.tier.cover;
        for (let k = 0; k < m; k++) {
          const j = idx[order[k]];
          if (j >= P.n) continue;
          const d = keyD[order[k]];
          if (d <= 0.1) continue;
          const r = P.r[j], dd = Math.max(d, r), c = Math.PI * r * P.rv[j] * p00 * p11 / (dd * dd) / 4 * Math.min(1, P.tau[j] * 3 + 0.2);   // (an eye inside a puff: at most its screen)
          if (cov + c > covMax && !nearT) nearT = d + r;
          cov += c;
        }
        nearS += (nearT - nearS) * (nearT > nearS ? 0.25 : 0.05);
        mat.uniforms.uNear.value = nearS;
        api.cover = cov;
        // write the instances, far first
        let w = 0;
        for (let k = 0; k < m; k++) {
          const j = idx[order[k]];
          if (j < P.n) {
            pos[w * 3] = P.p[j * 3]; pos[w * 3 + 1] = P.p[j * 3 + 1]; pos[w * 3 + 2] = P.p[j * 3 + 2];
            vel[w * 3] = P.v[j * 3]; vel[w * 3 + 1] = P.v[j * 3 + 1]; vel[w * 3 + 2] = P.v[j * 3 + 2];
            A[w * 4] = Math.min(1, P.age[j] / Math.max(1, sys.tier.life)); A[w * 4 + 1] = P.r[j]; A[w * 4 + 2] = P.seed[j]; A[w * 4 + 3] = 1;
            B[w * 4] = P.tau[j]; B[w * 4 + 1] = P.gy[j]; B[w * 4 + 2] = P.cls[j]; B[w * 4 + 3] = P.rv[j];
            // (the age the shader reads for its fade-in is the puff's seconds / life: a puff is born over its first moment)
            A[w * 4] = P.age[j] < 0.5 ? P.age[j] * 0.08 : Math.min(1, 0.04 + P.age[j] / Math.max(1, sys.tier.life));
          } else {
            const q = j - P.n;
            pos[w * 3] = G.p[q * 3]; pos[w * 3 + 1] = G.p[q * 3 + 1]; pos[w * 3 + 2] = G.p[q * 3 + 2];
            vel[w * 3] = G.v[q * 3]; vel[w * 3 + 1] = G.v[q * 3 + 1]; vel[w * 3 + 2] = G.v[q * 3 + 2];
            A[w * 4] = G.age[q] / G.life[q]; A[w * 4 + 1] = G.s[q]; A[w * 4 + 2] = G.seed[q]; A[w * 4 + 3] = G.kind[q];
            B[w * 4] = 1; B[w * 4 + 1] = -1e4; B[w * 4 + 2] = G.cls[q]; B[w * 4 + 3] = 0;
          }
          w++;
        }
        g.instanceCount = w; api.drawn = w;
        mesh.visible = w > 0;
        if (w) { aP.needsUpdate = true; aV.needsUpdate = true; aA.needsUpdate = true; aB.needsUpdate = true;
          aP.addUpdateRange && (aP.clearUpdateRanges(), aP.addUpdateRange(0, w * 3)); aV.addUpdateRange && (aV.clearUpdateRanges(), aV.addUpdateRange(0, w * 3));
          aA.addUpdateRange && (aA.clearUpdateRanges(), aA.addUpdateRange(0, w * 4)); aB.addUpdateRange && (aB.clearUpdateRanges(), aB.addUpdateRange(0, w * 4)); }
        if (light) {
          sunW.set(light.sun[0], light.sun[1], light.sun[2]).normalize().transformDirection(camera.matrixWorldInverse);
          mat.uniforms.uSunV.value.copy(sunW);
          if (light.sunCol) mat.uniforms.uSunCol.value.copy(light.sunCol);
          if (light.skyCol) mat.uniforms.uSkyCol.value.copy(light.skyCol);
          if (light.gndCol) mat.uniforms.uGndCol.value.copy(light.gndCol);
        }
        return w;
      },
      dispose() { g.dispose(); mat.dispose(); tex.dispose(); },
    };
    return api;
  }

  const DUST = { makeSystem, step, sources, make, emitPuff, emitGrit, billow, CLASSES, CLS, TIERS, TIER_OF, L, dryK, utK, GLSL: { vert: VERT, frag: FRAG } };
  if (typeof window !== 'undefined') window.DUST = DUST;
  if (typeof module !== 'undefined' && module.exports) module.exports = DUST;
})();
