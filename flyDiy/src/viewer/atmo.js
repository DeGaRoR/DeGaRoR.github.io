// ============================================================
// THE ATMOSPHERE — Hillaire 2020, by hand (SKY S3, 2026-09-14).
//
// "A Scalable and Production Ready Sky and Atmosphere Rendering Technique"
// (Sébastien Hillaire, EGSR 2020; the model Unreal ships). Written here
// rather than taken off the shelf because the shelf is WebGPU-only and the
// shipped renderer is WebGL (SKY-ATMOSPHERE §4b, RENDERER-DECISION §4k).
// Port-cheap by construction: the model and the DAY-ONLY tables live in JS
// and go up as DataTextures; the per-frame passes are standalone programs
// of pure functions (no chunk splices), so on flip day each is one TSL Fn.
//
//   the medium     Rayleigh (exp, H 8 km) + Mie (exp, H 1.2 km, Cornette-
//                  Shanks g 0.8, absorbing) + ozone (a tent 25 +/- 15 km),
//                  the paper's Table 1; the DAY scales Mie by its turbidity,
//                  ozone by its Dobson units, the ground by its albedo
//   transmittance  256 x 64 over (altitude, view zenith) - Bruneton's
//                  non-linear mapping; JS, 40 steps; re-baked on day.version
//   multi-scatter  32 x 32 over (sun zenith, altitude), Hillaire's Psi_ms =
//                  L2 / (1 - f_ms) from 64 uniform directions; JS
//   sky-view       192 x 108 over (azimuth, non-linear elevation about the
//                  horizon) from the camera's altitude, marched on the GPU
//                  every frame for the SUN and the MOON together - the
//                  moonlit sky for free
//   the dome       samples the sky-view, adds the limb-darkened sun disc,
//                  the phased moon and a hashed star field, and is
//                  TONE-MAPPED WITH THE SCENE (the raw palette retires)
//   aerial persp.  the froxel atlas (S4) - ATMO.install() is Session C's
//
// UNITS. Everything is per unit sun illuminance at the top of the
// atmosphere (E_sun = 1); the KEY is K_SUN x T(sun path), the dome is K_SUN
// x its radiance, the hemisphere K_SUN x the sky irradiance - one scale
// (sky_light.js fits K_SUN so the alps afternoon row the user judged comes
// out unchanged), and light_rig's exposure schedule does the rest.
//
// The CPU half is a mirror of the GLSL, step for step, so GATE ATMO can
// hold the model headless (and tools/atmo_lut.py holds the JS in turn).
// ============================================================
var ATMO = (function () {
  'use strict';
  const D2R = Math.PI / 180;
  // ---- the parameters (km) ------------------------------------------------
  const P0 = {
    Rg: 6360, Rt: 6460,
    rayS: [5.802e-3, 13.558e-3, 33.1e-3], rayH: 8,
    mieS: 3.996e-3, mieA: 4.40e-3, mieH: 1.2, mieG: 0.8,
    ozA: [0.650e-3, 1.881e-3, 0.085e-3], ozC: 25, ozW: 15,
    albedo: 0.15, sunRad: 0.2665 * D2R, moonRad: 0.259 * D2R,
    mieK: 1, ozK: 1, msK: 1,
  };
  const P = Object.assign({}, P0);
  let paramsKey = '';
  // the day's dials onto the parameters; true when the day-only tables must re-bake
  function setDay(day) {
    // the turbidity dial: Table 1's Mie is a very clear sky (vertical optical depth ~0.01), so the
    // day's turbidity (2.5 clear alpine .. 10 hazy) scales it on a power law - T10 is 15x, which
    // takes a 10.6 deg sun to ~45 % of its clear-sky transmittance (GATE ATMO holds the direction)
    const mieK = day ? Math.pow(Math.max(0.1, (day.turbidity - 1) / 1.5), 1.5) : 1;
    const ozK = day ? Math.max(0, day.ozone / 300) : 1;
    const alb = day ? day.groundAlbedo : 0.15;
    const key = mieK.toFixed(3) + '|' + ozK.toFixed(3) + '|' + alb.toFixed(3);
    if (key === paramsKey) return false;
    paramsKey = key; P.mieK = mieK; P.ozK = ozK; P.albedo = alb;
    return true;
  }

  // ---- the medium at height h (km): [dR, dM, dO] and the coefficients ----
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function medium(h, out) {
    const dR = Math.exp(-h / P.rayH), dM = Math.exp(-h / P.mieH) * P.mieK;
    const dO = Math.max(0, 1 - Math.abs(h - P.ozC) / P.ozW) * P.ozK;
    out.sR[0] = P.rayS[0] * dR; out.sR[1] = P.rayS[1] * dR; out.sR[2] = P.rayS[2] * dR;
    out.sM = P.mieS * dM;
    const eM = (P.mieS + P.mieA) * dM;
    out.e[0] = out.sR[0] + eM + P.ozA[0] * dO;
    out.e[1] = out.sR[1] + eM + P.ozA[1] * dO;
    out.e[2] = out.sR[2] + eM + P.ozA[2] * dO;
    return out;
  }
  const newMed = () => ({ sR: [0, 0, 0], sM: 0, e: [0, 0, 0] });
  // distance along (r, mu) to a sphere of radius R; -1 when it misses (mu = cos of the zenith angle)
  function raySphere(r, mu, R) {
    const b = r * mu, c = r * r - R * R, disc = b * b - c;
    if (disc < 0) return -1;
    const s = Math.sqrt(disc);
    const t0 = -b - s, t1 = -b + s;
    if (t1 < 0) return -1;
    return t0 >= 0 ? t0 : t1;
  }
  // the path's end: the ground if hit, else the top of the atmosphere
  function pathEnd(r, mu) {
    const tg = raySphere(r, mu, P.Rg);
    if (tg >= 0) return { t: tg, ground: true };
    return { t: raySphere(r, mu, P.Rt), ground: false };
  }

  // ---- transmittance: (r, mu) -> [Tr, Tg, Tb], 40 steps --------------------
  const _m = newMed();
  function transmittance(r, mu, steps) {
    const end = pathEnd(r, mu);
    if (end.t <= 0) return [1, 1, 1];
    const n = steps || 40, dt = end.t / n;
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * dt;
      const h = Math.sqrt(r * r + t * t + 2 * r * mu * t) - P.Rg;
      medium(h, _m);
      a += _m.e[0] * dt; b += _m.e[1] * dt; c += _m.e[2] * dt;
    }
    return [Math.exp(-a), Math.exp(-b), Math.exp(-c)];
  }
  // Bruneton's (r, mu) <-> (u, v) mapping: the LUT's whole resolution sits where the horizon is
  const TW = 256, TH = 64;
  function tUV(r, mu) {
    const H = Math.sqrt(P.Rt * P.Rt - P.Rg * P.Rg);
    const rho = Math.sqrt(Math.max(0, r * r - P.Rg * P.Rg));
    const disc = r * r * (mu * mu - 1) + P.Rt * P.Rt;
    const d = Math.max(0, -r * mu + Math.sqrt(Math.max(0, disc)));
    const dMin = P.Rt - r, dMax = rho + H;
    return [(d - dMin) / (dMax - dMin), rho / H];
  }
  function tFromUV(u, v) {
    const H = Math.sqrt(P.Rt * P.Rt - P.Rg * P.Rg);
    const rho = H * v;
    const r = Math.sqrt(rho * rho + P.Rg * P.Rg);
    const dMin = P.Rt - r, dMax = rho + H;
    const d = dMin + u * (dMax - dMin);
    const mu = d === 0 ? 1 : (H * H - rho * rho - d * d) / (2 * r * d);
    return [r, clamp(mu, -1, 1)];
  }
  let lutT = null;         // Float32Array TW*TH*4
  function bakeT() {
    lutT = new Float32Array(TW * TH * 4);
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
      const [r, mu] = tFromUV((i + 0.5) / TW, (j + 0.5) / TH);
      const T = transmittance(r, mu, 40);
      const k = (j * TW + i) * 4;
      lutT[k] = T[0]; lutT[k + 1] = T[1]; lutT[k + 2] = T[2]; lutT[k + 3] = 1;
    }
  }
  function lookup(lut, W, Hh, u, v, out) {   // bilinear, clamped
    const x = clamp(u * W - 0.5, 0, W - 1), y = clamp(v * Hh - 0.5, 0, Hh - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(Hh - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    for (let c = 0; c < 3; c++) {
      const a = lut[(y0 * W + x0) * 4 + c], b = lut[(y0 * W + x1) * 4 + c], cc = lut[(y1 * W + x0) * 4 + c], d = lut[(y1 * W + x1) * 4 + c];
      out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
    }
    return out;
  }
  const _t3 = [0, 0, 0];
  function T(r, mu, out) { if (!lutT) bakeT(); const uv = tUV(r, mu); return lookup(lutT, TW, TH, uv[0], uv[1], out || _t3); }

  // ---- multi-scatter: Psi_ms(r, mu_s), 32 x 32 -----------------------------
  const MW = 32, MH = 32;
  let lutMS = null;
  const _tm = [0, 0, 0], _tm2 = [0, 0, 0];
  // the 64 directions (a Fibonacci sphere) and their phase-free integrals
  const DIRS = (() => { const a = []; const n = 64; for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - y * y), ph = i * 2.399963; a.push([Math.cos(ph) * rr, y, Math.sin(ph) * rr]); } return a; })();
  function bakeMS() {
    lutMS = new Float32Array(MW * MH * 4);
    const steps = 20;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const muS = (i + 0.5) / MW * 2 - 1, r = P.Rg + (j + 0.5) / MH * (P.Rt - P.Rg);
      const L2 = [0, 0, 0], F = [0, 0, 0];
      for (const d of DIRS) {
        const mu = d[1];                                   // the zenith is +y; the sun sits in the x-y plane
        const sunX = Math.sqrt(1 - muS * muS), sunY = muS;
        const cosTheta = d[0] * sunX + d[1] * sunY;        // view . sun
        const end = pathEnd(r, mu);
        if (end.t <= 0) continue;
        const dt = end.t / steps;
        let Ta = 1, Tb = 1, Tc = 1, La = 0, Lb = 0, Lc = 0, Fa = 0, Fb = 0, Fc = 0;
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) * dt;
          const px = t * d[0], py = r + t * d[1], pz = t * d[2];
          const rr = Math.sqrt(px * px + py * py + pz * pz), h = rr - P.Rg;
          medium(h, _m);
          const muSp = (px * sunX + py * sunY) / rr;         // sun zenith at the sample
          const shadow = raySphere(rr, muSp, P.Rg) >= 0 ? 0 : 1;
          T(rr, muSp, _tm);
          const pR = 3 / (16 * Math.PI) * (1 + cosTheta * cosTheta), pM = phaseMie(cosTheta);
          for (let c = 0; c < 3; c++) {
            const sig = _m.sR[c] * pR + _m.sM * pM, sIso = (_m.sR[c] + _m.sM);
            const tr = c === 0 ? Ta : c === 1 ? Tb : Tc;
            const e = _m.e[c], seg = (1 - Math.exp(-e * dt)) / Math.max(1e-9, e);
            const dL = tr * sig * _tm[c] * shadow * seg, dF = tr * sIso * seg;
            if (c === 0) { La += dL; Fa += dF; } else if (c === 1) { Lb += dL; Fb += dF; } else { Lc += dL; Fc += dF; }
          }
          Ta *= Math.exp(-_m.e[0] * dt); Tb *= Math.exp(-_m.e[1] * dt); Tc *= Math.exp(-_m.e[2] * dt);
        }
        if (end.ground) {   // the ground's albedo bounces the sun that reaches it
          const gx = end.t * d[0], gy = r + end.t * d[1], gz = end.t * d[2], gr = Math.sqrt(gx * gx + gy * gy + gz * gz);
          const muG = (gx * sunX + gy * sunY) / gr;
          if (muG > 0) { T(gr, muG, _tm2); La += Ta * P.albedo / Math.PI * muG * _tm2[0]; Lb += Tb * P.albedo / Math.PI * muG * _tm2[1]; Lc += Tc * P.albedo / Math.PI * muG * _tm2[2]; }
        }
        L2[0] += La; L2[1] += Lb; L2[2] += Lc; F[0] += Fa; F[1] += Fb; F[2] += Fc;
      }
      const k = (j * MW + i) * 4, w = 1 / DIRS.length;   // uniform sphere: each direction is 4pi/64 sr, and the 1/(4pi) isotropic phase cancels it
      for (let c = 0; c < 3; c++) { const l2 = L2[c] * w, f = F[c] * w; lutMS[k + c] = P.msK * l2 / Math.max(1e-6, 1 - f); }
      lutMS[k + 3] = 1;
    }
  }
  function phaseMie(c) { const g = P.mieG, g2 = g * g; const k = 3 / (8 * Math.PI) * (1 - g2) / (2 + g2); return k * (1 + c * c) / Math.pow(1 + g2 - 2 * g * c, 1.5); }
  function MS(r, muS, out) { if (!lutMS) bakeMS(); return lookup(lutMS, MW, MH, (muS + 1) / 2, (r - P.Rg) / (P.Rt - P.Rg), out || _tm); }

  // ---- the sky's radiance along a ray (CPU mirror of the sky-view pass) ----
  // r: camera radius (km); d: view dir [x, y(up), z]; sun: unit vector; E: the light's illuminance (1 for the sun)
  const _ms = [0, 0, 0];
  const R_MIN = 0.01;      // the eye is never ON the ground sphere (a ray from r = Rg hits the ground at t = 0): 10 m up at least
  function skyRadiance(r, d, sun, E, steps, out) {
    r = Math.max(r, P.Rg + R_MIN);
    const mu = d[1], end = pathEnd(r, mu);
    out[0] = out[1] = out[2] = 0;
    if (end.t <= 0) return out;
    const n = steps || 32, dt = end.t / n;
    const cosTheta = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
    const pR = 3 / (16 * Math.PI) * (1 + cosTheta * cosTheta), pM = phaseMie(cosTheta);
    let Ta = 1, Tb = 1, Tc = 1;
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) * dt;
      const px = t * d[0], py = r + t * d[1], pz = t * d[2];
      const rr = Math.sqrt(px * px + py * py + pz * pz), h = rr - P.Rg;
      medium(h, _m);
      const muS = (px * sun[0] + py * sun[1] + pz * sun[2]) / rr;
      const shadow = raySphere(rr, muS, P.Rg) >= 0 ? 0 : 1;
      T(rr, muS, _tm); MS(rr, muS, _ms);
      const Ts = [Ta, Tb, Tc];
      for (let c = 0; c < 3; c++) {
        const S = (_m.sR[c] * pR + _m.sM * pM) * _tm[c] * shadow + (_m.sR[c] + _m.sM) * _ms[c];
        const e = _m.e[c];
        out[c] += Ts[c] * S * E * (1 - Math.exp(-e * dt)) / Math.max(1e-9, e);
      }
      Ta *= Math.exp(-_m.e[0] * dt); Tb *= Math.exp(-_m.e[1] * dt); Tc *= Math.exp(-_m.e[2] * dt);
    }
    if (end.ground) {   // the ground under the sky: albedo x (sun + sky) through the path's transmittance
      const gx = end.t * d[0], gy = r + end.t * d[1], gz = end.t * d[2], gr = Math.sqrt(gx * gx + gy * gy + gz * gz);
      const muG = (gx * sun[0] + gy * sun[1] + gz * sun[2]) / gr;
      T(gr, Math.max(0, muG), _tm2);
      const Ts = [Ta, Tb, Tc];
      for (let c = 0; c < 3; c++) out[c] += Ts[c] * P.albedo / Math.PI * E * (Math.max(0, muG) * _tm2[c] + 0.5 * _ms[c] * 4 * Math.PI * 0.1);
    }
    return out;
  }
  // the sky's irradiance on an upward-facing surface (cosine-weighted, 8 azimuths x 4 elevations), E_sun = 1
  function skyIrradiance(altKm, sun, out) {
    const r = P.Rg + Math.max(R_MIN, altKm); out = out || [0, 0, 0]; out[0] = out[1] = out[2] = 0;
    const L = [0, 0, 0];
    let wsum = 0;
    for (let j = 0; j < 4; j++) {
      const el = ((j + 0.5) / 4) * (Math.PI / 2), w = Math.cos(el) * Math.sin(el);   // cos-weighted, dOmega = cos(el) dEl dAz
      for (let i = 0; i < 8; i++) {
        const az = (i + 0.5) / 8 * 2 * Math.PI;
        skyRadiance(r, [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)], sun, 1, 16, L);
        out[0] += L[0] * w; out[1] += L[1] * w; out[2] += L[2] * w; wsum += w;
      }
    }
    const k = Math.PI / wsum;       // integral over the hemisphere of cos = pi
    out[0] *= k; out[1] *= k; out[2] *= k;
    return out;
  }
  // the sun's transmittance to a point at altKm, for a sun at elevation (unit vector's y)
  function sunTransmittance(altKm, sunY, out) { return T(P.Rg + Math.max(R_MIN, altKm), clamp(sunY, -1, 1), out || [0, 0, 0]); }

  // ---- GLSL: the same functions, for the passes and the dome ---------------
  const GLSL_LIB = `
    #define PI 3.14159265359
    uniform sampler2D uT, uMS;
    uniform vec4 uAtm[4];   // [0]=Rg,Rt,rayH,mieH  [1]=mieS,mieA,mieG,mieK  [2]=ozC,ozW,ozK,albedo  [3]=rayS
    uniform vec3 uOzA;
    float raySphere(float r, float mu, float R) {
      float b = r * mu, c = r * r - R * R, disc = b * b - c;
      if (disc < 0.0) return -1.0;
      float s = sqrt(disc), t0 = -b - s, t1 = -b + s;
      if (t1 < 0.0) return -1.0;
      return t0 >= 0.0 ? t0 : t1;
    }
    void medium(float h, out vec3 sR, out float sM, out vec3 e) {
      float dR = exp(-h / uAtm[0].z), dM = exp(-h / uAtm[0].w) * uAtm[1].w;
      float dO = max(0.0, 1.0 - abs(h - uAtm[2].x) / uAtm[2].y) * uAtm[2].z;
      sR = uAtm[3].xyz * dR; sM = uAtm[1].x * dM;
      e = sR + vec3((uAtm[1].x + uAtm[1].y) * dM) + uOzA * dO;
    }
    vec2 tUV(float r, float mu) {
      float Rg = uAtm[0].x, Rt = uAtm[0].y;
      float H = sqrt(Rt * Rt - Rg * Rg), rho = sqrt(max(0.0, r * r - Rg * Rg));
      float disc = r * r * (mu * mu - 1.0) + Rt * Rt;
      float d = max(0.0, -r * mu + sqrt(max(0.0, disc)));
      float dMin = Rt - r, dMax = rho + H;
      return vec2((d - dMin) / (dMax - dMin), rho / H);
    }
    vec3 T(float r, float mu) { return texture2D(uT, tUV(r, mu)).rgb; }
    vec3 MS(float r, float muS) { return texture2D(uMS, vec2((muS + 1.0) * 0.5, (r - uAtm[0].x) / (uAtm[0].y - uAtm[0].x))).rgb; }
    float phaseR(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
    float phaseM(float c) { float g = uAtm[1].z, g2 = g * g; return 3.0 / (8.0 * PI) * (1.0 - g2) / (2.0 + g2) * (1.0 + c * c) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
    // the scattered radiance along d from a camera at radius r, for one light (E = its illuminance), N steps
    vec3 skyRadiance(float r, vec3 d, vec3 sun, float E, int N, out vec3 Tpath) {
      float Rg = uAtm[0].x, Rt = uAtm[0].y, mu = d.y;
      float tg = raySphere(r, mu, Rg);
      bool ground = tg >= 0.0;
      float tEnd = ground ? tg : raySphere(r, mu, Rt);
      vec3 L = vec3(0.0); Tpath = vec3(1.0);
      if (tEnd <= 0.0) return L;
      float dt = tEnd / float(N);
      float ct = dot(d, sun), pR = phaseR(ct), pM = phaseM(ct);
      for (int s = 0; s < 48; s++) {
        if (s >= N) break;
        float t = (float(s) + 0.5) * dt;
        vec3 p = vec3(0.0, r, 0.0) + d * t;
        float rr = length(p), h = rr - Rg;
        vec3 sR, e; float sM; medium(h, sR, sM, e);
        float muS = dot(p, sun) / rr;
        float shadow = raySphere(rr, muS, Rg) >= 0.0 ? 0.0 : 1.0;
        vec3 S = (sR * pR + vec3(sM * pM)) * T(rr, muS) * shadow + (sR + vec3(sM)) * MS(rr, muS);
        vec3 seg = (1.0 - exp(-e * dt)) / max(vec3(1e-9), e);
        L += Tpath * S * E * seg;
        Tpath *= exp(-e * dt);
      }
      if (ground) {
        vec3 g = vec3(0.0, r, 0.0) + d * tEnd; float gr = length(g);
        float muG = max(0.0, dot(g, sun) / gr);
        L += Tpath * uAtm[2].w / PI * E * (muG * T(gr, muG) + 0.5 * MS(gr, muG) * 4.0 * PI * 0.1);
      }
      return L;
    }
    // the sky-view LUT's mapping: u = azimuth / 2pi (from -z, clockwise seen from above), v = 0.5 +/- sqrt(|el| / (pi/2)) / 2
    vec2 skyUV(vec3 d) {
      float el = asin(clamp(d.y, -1.0, 1.0));
      float az = atan(d.x, -d.z);
      float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (0.5 * PI));
      return vec2(az / (2.0 * PI) + 0.5, v);
    }
    vec3 skyDir(vec2 uv) {
      float az = (uv.x - 0.5) * 2.0 * PI;
      float s = uv.y - 0.5, el = sign(s) * (4.0 * s * s) * (0.5 * PI);
      return vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
    }
  `;
  // ---- the sky-view pass ---------------------------------------------------
  const SKYVIEW_FRAG = GLSL_LIB + `
    uniform float uR;            // the camera's radius (km)
    uniform vec3 uSun, uMoon;    // unit vectors
    uniform float uEMoon;        // the moon's illuminance (sun = 1)
    varying vec2 vUv2;
    void main() {
      vec3 d = skyDir(vUv2);
      vec3 Tp;
      vec3 L = skyRadiance(uR, d, uSun, 1.0, 32, Tp);
      if (uEMoon > 0.0) { vec3 Tm; L += skyRadiance(uR, d, uMoon, uEMoon, 12, Tm); }
      gl_FragColor = vec4(L, Tp.g);
    }`;
  const QUAD_VERT = `varying vec2 vUv2; void main(){ vUv2 = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  // ---- the aerial-perspective atlas (S4) -------------------------------------
  // Hillaire's froxel volume, made camera-independent for a forward renderer:
  // AP_N slices of DISTANCE (quadratic, 0 .. AP_DMAX km), each a 64 x 32 map of
  // DIRECTION (azimuth x the sky-view's non-linear elevation), laid side by side
  // in one 2048 x 32 target. A texel holds the in-scattered radiance to that
  // distance along that direction (rgb) and the path's transmittance (a). Every
  // material samples it by its own view vector and distance (the splice below),
  // so the far ridge fades into the sky it stands under and the fog wall goes.
  const AP_N = 32, AP_W = 64, AP_H = 32, AP_DMAX = 120.0;   // km
  // THE ATLAS CARRIES THE CLOUDS' SHADOW TILE TOO (CLOUDS C2): the island's ground program already
  // stands at the sampler limit (16), so the clouds' transmittance tile lives in the rows above the
  // aerial-perspective slices of this ONE texture every fogged material already binds - a 512^2
  // tile at row AP_TILE_Y, two rows of gap; apSample() reads the bottom AP_H rows only
  const AP_TILE = 512, AP_TILE_Y = AP_H + 2, AP_ATLAS_H = AP_TILE_Y + AP_TILE;
  const AP_FRAG = GLSL_LIB + `
    uniform float uR, uEMoon, uDmax;
    uniform vec3 uSun, uMoon;
    varying vec2 vUv2;
    void main() {
      float fx = vUv2.x * ${AP_N}.0;
      float k = floor(fx), u = fract(fx);
      vec3 d = skyDir(vec2(u, vUv2.y));
      float dist = uDmax * pow((k + 0.5) / ${AP_N}.0, 2.0);
      float Rg = uAtm[0].x, Rt = uAtm[0].y, mu = d.y, r = uR;
      float tg = raySphere(r, mu, Rg);
      float tEnd = tg >= 0.0 ? tg : raySphere(r, mu, Rt);
      tEnd = min(tEnd, dist);
      vec3 L = vec3(0.0), Tp = vec3(1.0);
      if (tEnd > 0.0) {
        float dt = tEnd / 12.0;
        float cs = dot(d, uSun), pRs = phaseR(cs), pMs = phaseM(cs);
        float cm = dot(d, uMoon), pRm = phaseR(cm), pMm = phaseM(cm);
        for (int s = 0; s < 12; s++) {
          float t = (float(s) + 0.5) * dt;
          vec3 p = vec3(0.0, r, 0.0) + d * t;
          float rr = length(p), h = rr - Rg;
          vec3 sR, e; float sM; medium(h, sR, sM, e);
          float muS = dot(p, uSun) / rr;
          float shadow = raySphere(rr, muS, Rg) >= 0.0 ? 0.0 : 1.0;
          vec3 S = (sR * pRs + vec3(sM * pMs)) * T(rr, muS) * shadow + (sR + vec3(sM)) * MS(rr, muS);
          if (uEMoon > 0.0) { float muM = dot(p, uMoon) / rr; float shm = raySphere(rr, muM, Rg) >= 0.0 ? 0.0 : 1.0;
            S += uEMoon * ((sR * pRm + vec3(sM * pMm)) * T(rr, muM) * shm + (sR + vec3(sM)) * MS(rr, muM)); }
          vec3 seg = (1.0 - exp(-e * dt)) / max(vec3(1e-9), e);
          L += Tp * S * seg;
          Tp *= exp(-e * dt);
        }
      }
      gl_FragColor = vec4(L, Tp.g);
    }`;
  // THE ONE SPLICE (RENDERER-DECISION §4k rule 3). three lays its fog on AFTER
  // the tone map, in display space (r186: opaque -> tonemapping -> colorspace ->
  // fog), so a physical in-scatter cannot live in fog_fragment: it goes at the
  // head of tonemapping_fragment, where gl_FragColor is still linear radiance,
  // guarded by USE_FOG (a material's own `fog` flag, and a scene with a fog
  // object) and by the shared flag uAtmoAP.z (the world sets it; the shed,
  // which keeps its dark-wall smoothstep, clears it). fog_vertex exports the
  // view-space position; the fragment rebuilds the world view ray from it
  // through viewMatrix (rigid: the transpose is the inverse rotation).
  const AP_PARS_VERT = `varying vec3 vAtmoV;`;
  const AP_VERT = `vFogDepth = - mvPosition.z; vAtmoV = mvPosition.xyz;`;
  // THE MIST's GLSL and the atlas sample stand alone (CLOUDS C1: the cloud march applies the same
  // aerial perspective and the same mist to a cloud at its own distance - ATMO.GLSL hands them over)
  const MIST_GLSL = `
    // THE MIST (SKY S7): an exponential height layer over the world - density rho0 (per metre)
    // below its top yTop, decaying over H above it - integrated in closed form along the ray
    // (piecewise at the top plane), lit by the day (uMist[1].rgb: sun x T + sky at the mist, on
    // the dome's scale) with a forward peak toward the sun. uMist[0] = (rho0, yTop, H, on),
    // uMist[1] = (colour rgb, forward strength), uMist[2] = (sun dir xyz, 0). World metres.
    // uMist[3] = (rhoC, base, top, 0): IN CLOUD (CLOUDS C4) - the layer the eye is in, as a uniform slab
    // between two heights (its density the field's at the eye); the white-out is the mist's own machinery
    uniform vec4 uMist[4];
    float slabLen(float y0, float dy, float D, float yb, float yt) {   // the length of [0, D] along the ray inside the slab
      if (abs(dy) < 1e-5) return (y0 >= yb && y0 <= yt) ? D : 0.0;
      float ta = (yb - y0) / dy, tb = (yt - y0) / dy;
      float t0 = max(0.0, min(ta, tb)), t1 = min(D, max(ta, tb));
      return max(0.0, t1 - t0);
    }
    float mistAbove(float ya, float dy, float ta, float tb, float H) {   // optical depth over [ta, tb] above the top, density exp(-(y - yTop)/H)
      if (abs(dy) < 1e-4) return (tb - ta) * exp(-ya / H);
      return (H / dy) * (exp(-(ya + dy * ta) / H) - exp(-(ya + dy * tb) / H));
    }
    float mistOD(float y0, float dy, float D) {
      float rho0 = uMist[0].x, yTop = uMist[0].y, H = max(1.0, uMist[0].z);
      float ya = y0 - yTop, y1 = ya + dy * D;
      if (ya <= 0.0 && y1 <= 0.0) return rho0 * D;
      if (ya > 0.0 && y1 > 0.0) return rho0 * mistAbove(ya, dy, 0.0, D, H);
      float ts = -ya / dy;                                    // the crossing of the top plane
      if (ya <= 0.0) return rho0 * (ts + mistAbove(ya, dy, ts, D, H));
      return rho0 * (mistAbove(ya, dy, 0.0, ts, H) + (D - ts));
    }
    // col -> col through the mist along world dir d for D metres from the eye at y0
    vec3 mistApply(vec3 col, vec3 d, float D, float y0) {
      if (uMist[0].w < 0.5 || (uMist[0].x <= 0.0 && uMist[3].x <= 0.0)) return col;
      float od = uMist[0].x > 0.0 ? mistOD(y0, d.y, D) : 0.0;
      if (uMist[3].x > 0.0) od += uMist[3].x * slabLen(y0, d.y, D, uMist[3].y, uMist[3].z);
      float T = exp(-od);
      float fwd = 1.0 + uMist[1].w * pow(max(0.0, dot(d, uMist[2].xyz)), 8.0);
      return col * T + uMist[1].rgb * fwd * (1.0 - T);
    }`;
  // apSample(d, distKm): the atlas at a world direction and a distance (the splice's own read, and the clouds')
  const AP_SAMPLE_GLSL = `
    uniform sampler2D uApAtlas;
    uniform vec4 uAtmoAP;      // x: the radiance scale (K_SUN x unit), y: dmax (km), z: on/off, w: unused
    vec4 apSample(vec3 d, float dist) {
      float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z);
      float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / 1.57079632679);
      float u = az / 6.28318530718 + 0.5;
      float s = sqrt(clamp(dist / uAtmoAP.y, 0.0, 1.0)) * ${AP_N}.0 - 0.5;
      float k0 = floor(s), f = s - k0;
      float k1 = min(k0 + 1.0, ${AP_N}.0 - 1.0);
      float uu = clamp(u, 0.5 / ${AP_W}.0, 1.0 - 0.5 / ${AP_W}.0);
      v = clamp(v * ${AP_H}.0, 0.5, ${AP_H}.0 - 0.5) / ${AP_ATLAS_H}.0;   // the AP rows of the shared atlas
      vec4 a = k0 < 0.0 ? vec4(0.0, 0.0, 0.0, 1.0) : texture2D(uApAtlas, vec2((k0 + uu) / ${AP_N}.0, v));
      vec4 b = texture2D(uApAtlas, vec2((k1 + uu) / ${AP_N}.0, v));
      return mix(a, b, f);
    }`;
  const AP_PARS_FRAG = `
    varying vec3 vAtmoV;
    ` + AP_SAMPLE_GLSL + MIST_GLSL + `
    vec4 atmoAP() { return apSample(normalize((vec4(vAtmoV, 0.0) * viewMatrix).xyz), length(vAtmoV) * 0.001); }`;
  const AP_APPLY = `
    #ifdef USE_FOG
    if (uAtmoAP.z > 0.5) {
      vec4 ap = atmoAP(); gl_FragColor.rgb = gl_FragColor.rgb * ap.a + ap.rgb * uAtmoAP.x * gl_FragColor.a;
      gl_FragColor.rgb = mistApply(gl_FragColor.rgb, normalize((vec4(vAtmoV, 0.0) * viewMatrix).xyz), length(vAtmoV), cameraPosition.y);
    }
    #endif
  `;
  // the legacy fog (display space) stays for a scene that wants it (the shed): the flag decides
  const AP_FOG_FRAG = `
    #ifdef USE_FOG
    if (uAtmoAP.z < 0.5) {
      #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
      #endif
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    }
    #endif
  `;
  const apScalars = new Float32Array([1, AP_DMAX, 0, 0]);    // shared by REFERENCE through every material's clone
  const mistScalars = new Float32Array(16);                    // [rho0, yTop, H, on | colour rgb, fwd | sun xyz, 0 | rhoC, base, top, 0 (in cloud, CLOUDS C4)]
  const apUniforms = { uApAtlas: { value: null }, uAtmoAP: { value: apScalars }, uMist: { value: mistScalars } };
  // THE MIST'S DIALS: on/off (the GRAPHICS menu), the density as a multiplier over the day's own
  // (humidity: rho0 = 0.0025/m x ((rh - 0.7) / 0.3)^2 - saturated air sees 1.2 km), its top (m ASL)
  // and thickness (m), the forward peak. F8's atmosphere fold writes these.
  const MIST = { on: true, k: 1, top: 60, H: 18, fwd: 0.8, rhoDay: 0, get rho0() { return this.rhoDay * this.k; },
    cloud: { rho: 0, base: 0, top: 0 } };                       // the slab the eye is in (clouds.js writes it)
  let installed = false;
  function install() {
    if (installed || typeof THREE === 'undefined' || !THREE.ShaderChunk || !THREE.ShaderLib) return false;
    if (typeof window !== 'undefined' && window.FLYDIY_RENDERER && window.FLYDIY_RENDERER.isWebGPURenderer) return false;   // the node renderer reads no chunk
    const SC = THREE.ShaderChunk;
    SC.fog_pars_vertex = (SC.fog_pars_vertex || '') + '\n' + AP_PARS_VERT;
    SC.fog_vertex = '#ifdef USE_FOG\n' + AP_VERT + '\n#endif\n';
    SC.fog_pars_fragment = (SC.fog_pars_fragment || '') + '\n#ifdef USE_FOG\n' + AP_PARS_FRAG + '\n#endif\n';
    SC.fog_fragment = AP_FOG_FRAG;
    SC.tonemapping_fragment = AP_APPLY + '\n' + (SC.tonemapping_fragment || '');
    for (const k of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'sprite']) {
      const lib = THREE.ShaderLib[k]; if (lib && lib.uniforms) { lib.uniforms.uAtmoAP = apUniforms.uAtmoAP; lib.uniforms.uMist = apUniforms.uMist; }
    }
    // EVERY MATERIAL TAKES THE SAMPLER, a hook of its own or not (G432.2, the user: "check why the
    // houses don't render"): the prototype's onBeforeCompile is an ACCESSOR - a material's own hook is
    // kept aside and served back wrapped in inject(); three reads the property at compile time and for
    // the program cache key (customProgramCacheKey = onBeforeCompile.toString()), so the wrapper's
    // toString carries the hook's own text. Before this the world pack's generators (the houses, the
    // big buildings, the towers, the mill) hooked their materials without inject and DREW NOTHING in
    // the game: a sampler never given a unit shares unit 0 with the map, and a draw whose samplers
    // disagree on a unit is refused whole by GL - no error on the console, no shader diagnostic, the
    // yards around them fine. A hook that still calls inject itself is harmless (inject is idempotent).
    const proto = THREE.Material.prototype;
    const WRAP = new WeakMap();
    const injectOnly = function (sh) { inject(sh); };
    injectOnly.toString = () => 'atmo.inject';
    Object.defineProperty(proto, 'onBeforeCompile', {
      configurable: true,
      get() {
        const f = this._atmoHook;
        if (!f) return injectOnly;
        let w = WRAP.get(f);
        if (!w) { w = function (sh, r) { inject(sh); return f.call(this, sh, r); }; w.toString = () => 'atmo.inject+' + f.toString(); WRAP.set(f, w); }
        return w;
      },
      set(f) { this._atmoHook = f || null; },
    });
    installed = true;
    return true;
  }
  // inject(shader): the atlas sampler (a render-target texture cannot ride ShaderLib: cloneUniforms nulls it) - idempotent, text-guarded
  function inject(sh) {
    if (!sh || !sh.uniforms || sh.uniforms.uApAtlas) return;
    if (!/fog_pars_fragment|USE_FOG/.test(sh.fragmentShader || '')) return;
    sh.uniforms.uApAtlas = apUniforms.uApAtlas;
    if (!sh.uniforms.uAtmoAP) sh.uniforms.uAtmoAP = apUniforms.uAtmoAP;
    if (!sh.uniforms.uMist) sh.uniforms.uMist = apUniforms.uMist;
    if (typeof CLOUDS !== 'undefined' && CLOUDS.inject) CLOUDS.inject(sh);   // the clouds' shadow sampler rides the same two paths (C2)
  }
  function setAP(on) { apScalars[2] = on ? 1 : 0; }

  // ---- the dome ------------------------------------------------------------
  // The sky-view sample, the sun and moon discs from the transmittance, the
  // stars. Radiance x uScale (= K_SUN, sky_light.js), then three's own tone
  // map and output encoding - the dome is LIT like the ground it meets.
  const DOME_FRAG = `
    uniform sampler2D uSky, uT2;
    uniform vec4 uAtm2;           // Rg, Rt, sunRad, moonRad
    uniform float uR, uScale, uEMoon, uStars, uFrame;   // uFrame: the room's yaw onto the world's frame (the shed is a quarter turn)
    uniform float uGlare, uEyeY;                          // the corona's strength (S7); the eye's height for the mist
    // THE VEIL (CLOUDS C4): cirrus / cirrostratus - a 2D noise sheet at uVeil.w metres, its coverage
    // uVeil.x (a threshold on the noise like the weather map's), drifted by uVeil.yz, optically thin:
    // L += (sun x T at the sheet x a forward phase + the sky's radiance there) x (1 - exp(-tau))
    uniform vec4 uVeil; uniform vec3 uVeilSun, uVeilSky;
    float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x), mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float vfbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.03 + 7.1) * 0.25 + vnoise(p * 4.07 + 3.3) * 0.125 + vnoise(p * 8.1 + 1.7) * 0.0625; }
    vec3 veil(vec3 d, vec3 sunDir) {
      if (uVeil.x <= 0.0 || d.y < 0.015) return vec3(0.0);
      vec2 p = d.xz * (uVeil.w / d.y) + uVeil.yz;               // the sheet's plane, drifted
      float n = vfbm(p / 60000.0) * 0.6 + vfbm(p / 9000.0 + 11.0) * 0.4;   // sheets of 60 km, streaks of 9 km
      float v = smoothstep(1.0 - uVeil.x, 1.0 - uVeil.x + 0.4, n * 1.2 - 0.1);
      float tau = 0.6 * v / max(d.y, 0.12);                     // the path through a thin sheet lengthens toward the horizon
      float c = dot(d, sunDir), g = 0.55;
      float ph = (1.0 - g * g) / (12.5663706 * pow(1.0 + g * g - 2.0 * g * c, 1.5)) * 8.0;   // a forward lobe, 8x the isotropic
      return (uVeilSun * ph + uVeilSky) * (1.0 - exp(-tau));
    }

    // THE MIST (SKY S7): an exponential height layer over the world - density rho0 (per metre)
    // below its top yTop, decaying over H above it - integrated in closed form along the ray
    // (piecewise at the top plane), lit by the day (uMist[1].rgb: sun x T + sky at the mist, on
    // the dome's scale) with a forward peak toward the sun. uMist[0] = (rho0, yTop, H, on),
    // uMist[1] = (colour rgb, forward strength), uMist[2] = (sun dir xyz, 0). World metres.
    // uMist[3] = (rhoC, base, top, 0): IN CLOUD (CLOUDS C4) - the layer the eye is in, as a uniform slab
    // between two heights (its density the field's at the eye); the white-out is the mist's own machinery
    uniform vec4 uMist[4];
    float slabLen(float y0, float dy, float D, float yb, float yt) {   // the length of [0, D] along the ray inside the slab
      if (abs(dy) < 1e-5) return (y0 >= yb && y0 <= yt) ? D : 0.0;
      float ta = (yb - y0) / dy, tb = (yt - y0) / dy;
      float t0 = max(0.0, min(ta, tb)), t1 = min(D, max(ta, tb));
      return max(0.0, t1 - t0);
    }
    float mistAbove(float ya, float dy, float ta, float tb, float H) {   // optical depth over [ta, tb] above the top, density exp(-(y - yTop)/H)
      if (abs(dy) < 1e-4) return (tb - ta) * exp(-ya / H);
      return (H / dy) * (exp(-(ya + dy * ta) / H) - exp(-(ya + dy * tb) / H));
    }
    float mistOD(float y0, float dy, float D) {
      float rho0 = uMist[0].x, yTop = uMist[0].y, H = max(1.0, uMist[0].z);
      float ya = y0 - yTop, y1 = ya + dy * D;
      if (ya <= 0.0 && y1 <= 0.0) return rho0 * D;
      if (ya > 0.0 && y1 > 0.0) return rho0 * mistAbove(ya, dy, 0.0, D, H);
      float ts = -ya / dy;                                    // the crossing of the top plane
      if (ya <= 0.0) return rho0 * (ts + mistAbove(ya, dy, ts, D, H));
      return rho0 * (mistAbove(ya, dy, 0.0, ts, H) + (D - ts));
    }
    // col -> col through the mist along world dir d for D metres from the eye at y0
    vec3 mistApply(vec3 col, vec3 d, float D, float y0) {
      if (uMist[0].w < 0.5 || (uMist[0].x <= 0.0 && uMist[3].x <= 0.0)) return col;
      float od = uMist[0].x > 0.0 ? mistOD(y0, d.y, D) : 0.0;
      if (uMist[3].x > 0.0) od += uMist[3].x * slabLen(y0, d.y, D, uMist[3].y, uMist[3].z);
      float T = exp(-od);
      float fwd = 1.0 + uMist[1].w * pow(max(0.0, dot(d, uMist[2].xyz)), 8.0);
      return col * T + uMist[1].rgb * fwd * (1.0 - T);
    }
    uniform vec3 uSun, uMoon;
    varying vec3 vD;
    float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
    vec2 tUV2(float r, float mu) {
      float Rg = uAtm2.x, Rt = uAtm2.y;
      float H = sqrt(Rt * Rt - Rg * Rg), rho = sqrt(max(0.0, r * r - Rg * Rg));
      float d = max(0.0, -r * mu + sqrt(max(0.0, r * r * (mu * mu - 1.0) + Rt * Rt)));
      return vec2((d - (Rt - r)) / (rho + H - (Rt - r)), rho / H);
    }
    vec2 skyUV2(vec3 d) {
      float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z);
      return vec2(az / 6.28318530718 + 0.5, 0.5 + 0.5 * sign(el) * sqrt(abs(el) / 1.57079632679));
    }
    void main() {
      vec3 d = normalize(vD);
      { float c = cos(uFrame), s = sin(uFrame); d = vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c); }   // into the world's frame
      vec4 sky = texture2D(uSky, skyUV2(d));
      vec3 L = sky.rgb;
      float Tview = sky.a;                                   // the path's (green) transmittance, for the discs and stars
      // the sun: a limb-darkened disc of angular radius sunRad, through the transmittance along its own path
      float cs = dot(d, uSun), sr = uAtm2.z;
      float ang = acos(clamp(cs, -1.0, 1.0));
      if (ang < sr * 1.5 && uSun.y > -0.1) {
        float x = clamp(ang / sr, 0.0, 1.0);
        float limb = 1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - x * x)));
        float edge = 1.0 - smoothstep(sr * 0.96, sr * 1.04, ang);
        vec3 Tsun = texture2D(uT2, tUV2(uR, uSun.y)).rgb;
        float above = raySphere2(uR, d.y, uAtm2.x) < 0.0 ? 1.0 : 0.0;
        L += Tsun * limb * edge * above / (3.14159265 * sr * sr);
      }
      // the moon: a sphere lit by the sun, albedo 0.12, its own transmittance
      float cm = dot(d, uMoon), mr = uAtm2.w;
      float angm = acos(clamp(cm, -1.0, 1.0));
      if (uEMoon > 0.0 && angm < mr * 1.5 && uMoon.y > -0.1) {
        vec3 o = (d - uMoon * cm) / mr;                        // offset on the disc, |o| <= 1
        float o2 = min(1.0, dot(o, o));
        vec3 n = normalize(o - uMoon * sqrt(1.0 - o2));       // the sphere's normal, facing the viewer
        float lit = max(0.0, dot(n, uSun));
        float edge = 1.0 - smoothstep(mr * 0.94, mr * 1.06, angm);
        vec3 Tm = texture2D(uT2, tUV2(uR, uMoon.y)).rgb;
        float above = raySphere2(uR, d.y, uAtm2.x) < 0.0 ? 1.0 : 0.0;
        // the disc's radiance = albedo/pi x (sun on the moon) - the sun's illuminance at the moon is 1: E_moon on us = albedo/pi x omega
        L += Tm * 0.12 / 3.14159265 * lit * edge * above * 1.0;
      }
      // the stars: a hashed field on a fine grid, hidden by the sky's own light and the path's transmittance.
      // IN THE SUN'S UNITS: the whole starry sky is ~2e-9 of the sun's illuminance, so one star texel is
      // ~1e-5 here - anything brighter blurs into a glow in the reflection probe (measured: a white night)
      if (uStars > 0.0 && d.y > -0.02) {
        vec3 g = floor(d * 900.0);
        float h = hash13(g), h2 = hash13(g + 17.0);
        float star = smoothstep(0.985, 1.0, h) * (0.4 + 0.6 * h2);
        vec3 tint = mix(vec3(1.0, 0.9, 0.8), vec3(0.8, 0.9, 1.0), h2);
        float lum = dot(L, vec3(0.2126, 0.7152, 0.0722));
        L += tint * star * uStars * 1.5e-5 * Tview * (1.0 - smoothstep(0.0, 3e-6, lum));
      }
      L += veil(d, uSun);                                      // THE VEIL (C4): over the sun and moon discs, under the corona
      // THE CORONA (S7): the eye's own scatter around a disc ten thousand times the sky - a 1/theta^2
      // lobe (Spencer et al. 1995) through the sun's transmittance, a degree wide, on the disc's own
      // colour; the moon gets a faint one
      if (uGlare > 0.0) {
        vec3 Tsun = texture2D(uT2, tUV2(uR, uSun.y)).rgb;
        float above = raySphere2(uR, d.y, uAtm2.x) < 0.0 ? 1.0 : 0.0;
        float a = max(ang, sr);
        L += Tsun * uGlare * above * 0.02 / (1.0 + pow(a / 0.02, 2.0)) * smoothstep(-0.05, 0.02, uSun.y);
        if (uEMoon > 0.0) L += texture2D(uT2, tUV2(uR, uMoon.y)).rgb * uEMoon * uGlare * above * 0.4 / (1.0 + pow(max(angm, mr) / 0.02, 2.0)) * smoothstep(-0.05, 0.02, uMoon.y);
      }
      // the mist over the sky itself: a ray above the horizon leaves the layer (the integral converges)
      L = mistApply(L * uScale, d, 60000.0, uEyeY) / max(1e-9, uScale);
      gl_FragColor = vec4(L * uScale, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const DOME_VERT = `varying vec3 vD; void main(){ vD = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

  // ---- the GPU half ---------------------------------------------------------
  const G = { ready: false, enabled: false, texT: null, texMS: null, rtSky: null, rtAP: null, quad: null, cam: null, skyMat: null, apMat: null, atmU: null };
  const U = {                                   // shared uniform objects (one value each, every consumer reads them)
    sun: null, moon: null, eMoon: { value: 0 }, r: { value: 6360.0 }, scale: { value: 1 }, stars: { value: 1 },
    glare: { value: 1 }, eyeY: { value: 0 },
    veil: { value: new Float32Array([0, 0, 0, 9000]) }, veilSun: { value: new Float32Array(3) }, veilSky: { value: new Float32Array(3) },   // CLOUDS C4
  };
  function uploadTex(tex, lut, W, Hh) {
    const half = new Uint16Array(W * Hh * 4);
    for (let i = 0; i < lut.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(65000, lut[i]));
    if (tex) { tex.image.data.set(half); tex.needsUpdate = true; return tex; }
    const t = new THREE.DataTexture(half, W, Hh, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  }
  function atmUniforms() {
    return {
      uT: { value: G.texT }, uMS: { value: G.texMS },
      uAtm: { value: [new THREE.Vector4(P.Rg, P.Rt, P.rayH, P.mieH), new THREE.Vector4(P.mieS, P.mieA, P.mieG, P.mieK),
                      new THREE.Vector4(P.ozC, P.ozW, P.ozK, P.albedo), new THREE.Vector4(P.rayS[0], P.rayS[1], P.rayS[2], 0)] },
      uOzA: { value: new THREE.Vector3(P.ozA[0], P.ozA[1], P.ozA[2]) },
    };
  }
  function refreshAtmUniforms(u) {
    u.uT.value = G.texT; u.uMS.value = G.texMS;
    u.uAtm.value[1].w = P.mieK; u.uAtm.value[2].z = P.ozK; u.uAtm.value[2].w = P.albedo;
  }
  function init(renderer) {
    if (G.ready) return G.enabled;
    G.ready = true;
    if (typeof THREE === 'undefined' || !renderer || renderer.isWebGPURenderer || !THREE.DataUtils || !THREE.WebGLRenderTarget) return (G.enabled = false);
    U.sun = { value: new THREE.Vector3(0, 1, 0) }; U.moon = { value: new THREE.Vector3(0, -1, 0) };
    if (!lutT) bakeT(); if (!lutMS) bakeMS();
    G.texT = uploadTex(null, lutT, TW, TH); G.texMS = uploadTex(null, lutMS, MW, MH);
    G.rtSky = new THREE.WebGLRenderTarget(192, 108, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    G.rtSky.texture.wrapS = THREE.RepeatWrapping; G.rtSky.texture.wrapT = THREE.ClampToEdgeWrapping;
    G.atmU = atmUniforms();
    G.skyMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uR: U.r, uSun: U.sun, uMoon: U.moon, uEMoon: U.eMoon }, G.atmU),
      vertexShader: QUAD_VERT, fragmentShader: SKYVIEW_FRAG, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    G.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), G.skyMat); G.quad.frustumCulled = false;
    G.scene = new THREE.Scene(); G.scene.add(G.quad);
    G.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // the aerial-perspective atlas and its pass
    G.rtAP = new THREE.WebGLRenderTarget(AP_N * AP_W, AP_ATLAS_H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    G.rtAP.texture.wrapS = THREE.ClampToEdgeWrapping; G.rtAP.texture.wrapT = THREE.ClampToEdgeWrapping;
    G.apMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uR: U.r, uSun: U.sun, uMoon: U.moon, uEMoon: U.eMoon, uDmax: { value: AP_DMAX } }, G.atmU),
      vertexShader: QUAD_VERT, fragmentShader: AP_FRAG, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    apUniforms.uApAtlas.value = G.rtAP.texture;
    G.enabled = true;
    return true;
  }
  // update(renderer, day, camAltM): the day-only tables on a change, the sky-view every call
  let lastVer = -1;
  const _vp = (typeof THREE !== 'undefined' && THREE.Vector4) ? new THREE.Vector4() : null, _sc = _vp ? new THREE.Vector4() : null;
  function update(renderer, day, camAltM) {
    if (!G.enabled) return false;
    if (setDay(day) || lastVer < 0) { bakeT(); bakeMS(); uploadTex(G.texT, lutT, TW, TH); uploadTex(G.texMS, lutMS, MW, MH); refreshAtmUniforms(G.atmU); lastVer = day ? day.version : 0; }
    const s = day ? day.sun : [0, 1, 0], m = day ? day.moon : [0, -1, 0];
    U.sun.value.set(s[0], s[1], s[2]); U.moon.value.set(m[0], m[1], m[2]);
    U.eMoon.value = day ? (typeof LIGHT_RIG !== 'undefined' ? LIGHT_RIG.MOON_RATIO : 2.5e-6) * day.moonPhase : 0;
    U.r.value = P.Rg + Math.max(R_MIN, (camAltM || 0) / 1000);
    const prev = renderer.getRenderTarget(), ac = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(G.rtSky); renderer.render(G.scene, G.cam);
    if (installed && G.rtAP) {   // the AP pass writes its own rows of the shared atlas (the clouds' tile keeps the rest)
      G.quad.material = G.apMat; renderer.setRenderTarget(G.rtAP);
      renderer.getViewport(_vp); renderer.getScissor(_sc); const st = renderer.getScissorTest();
      renderer.setViewport(0, 0, AP_N * AP_W, AP_H); renderer.setScissor(0, 0, AP_N * AP_W, AP_H); renderer.setScissorTest(true);
      renderer.render(G.scene, G.cam);
      renderer.setScissorTest(st); renderer.setViewport(_vp); renderer.setScissor(_sc);
      G.quad.material = G.skyMat;
    }
    renderer.setRenderTarget(prev); renderer.autoClear = ac;
    apScalars[0] = U.scale.value;
    U.eyeY.value = camAltM || 0;
    // the mist's day: its density from the humidity, its colour from the sun and the sky at its top
    if (day) {
      const rh = day.rh != null ? day.rh : 0.5;
      MIST.rhoDay = 0.0025 * Math.pow(Math.max(0, Math.min(1, (rh - 0.7) / 0.3)), 2);
      const km = MIST.top / 1000, T = [0, 0, 0], E = [0, 0, 0], Em = [0, 0, 0];
      sunTransmittance(km, day.sun[1], T); skyIrradiance(km, day.sun, E);
      const sy = Math.max(0, day.sun[1]);
      if (U.eMoon.value > 0 && day.moon[1] > 0) { skyIrradiance(km, day.moon, Em); const mE = U.eMoon.value; E[0] += Em[0] * mE; E[1] += Em[1] * mE; E[2] += Em[2] * mE; }
      const S = U.scale.value * 0.9 / Math.PI;
      mistScalars[0] = MIST.rho0; mistScalars[1] = MIST.top; mistScalars[2] = MIST.H; mistScalars[3] = MIST.on ? 1 : 0;
      mistScalars[4] = S * (0.5 * T[0] * sy + E[0]); mistScalars[5] = S * (0.5 * T[1] * sy + E[1]); mistScalars[6] = S * (0.5 * T[2] * sy + E[2]); mistScalars[7] = MIST.fwd;
      mistScalars[8] = day.sun[0]; mistScalars[9] = day.sun[1]; mistScalars[10] = day.sun[2]; mistScalars[11] = 0;
      mistScalars[12] = MIST.on ? MIST.cloud.rho : 0; mistScalars[13] = MIST.cloud.base; mistScalars[14] = MIST.cloud.top; mistScalars[15] = 0;
    }
    return true;
  }
  // the dome material: one program serves the screen and the reflection probe
  function domeMat(extra, frameYaw) {
    if (!G.enabled) return null;
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: { uSky: { value: G.rtSky.texture }, uT2: { value: G.texT }, uAtm2: { value: new THREE.Vector4(P.Rg, P.Rt, P.sunRad, P.moonRad) },
                  uR: U.r, uScale: U.scale, uEMoon: U.eMoon, uStars: U.stars, uSun: U.sun, uMoon: U.moon, uFrame: { value: frameYaw || 0 },
                  uGlare: U.glare, uEyeY: U.eyeY, uMist: apUniforms.uMist, uVeil: U.veil, uVeilSun: U.veilSun, uVeilSky: U.veilSky },
      vertexShader: DOME_VERT,
      fragmentShader: `float raySphere2(float r, float mu, float R) { float b = r * mu, c = r * r - R * R, disc = b * b - c; if (disc < 0.0) return -1.0; float s = sqrt(disc), t0 = -b - s, t1 = -b + s; if (t1 < 0.0) return -1.0; return t0 >= 0.0 ? t0 : t1; }\n` + DOME_FRAG,
      side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }, extra || {}));
    m.uniforms.uT2.value = G.texT;
    return m;
  }

  // ---- THE PROBE (S5): a PMREM of the sky, re-baked when the sun moves ----
  // One generator kept alive (its blur shaders compile once); each bake shoots
  // a throwaway scene of the dome and a ground cap LIT BY THE DAY into a new
  // target, hands it back, and disposes the previous one after the swap. Both
  // rooms take one (the shed's in its own frame): the aeroplane's skin, the
  // glazing, the water and the shed's outdoors read it, and the sunset through
  // the windows moves with the sun at last.
  const lum3 = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  function groundIrradiance(day) {              // the ground's irradiance relative to the alps anchor (0..~1.2)
    const T = [0, 0, 0], E = [0, 0, 0];
    const Eg = v => { sunTransmittance(0, v[1], T); skyIrradiance(0, v, E); return Math.max(0, v[1]) * lum3(T) + lum3(E); };
    const ref = Eg([0, Math.sin(33.4 * D2R), Math.cos(33.4 * D2R)]);
    return Math.min(1.5, Eg(day ? day.sun : [0, 1, 0]) / Math.max(1e-9, ref));
  }
  function makeProbe(renderer, o) {
    o = o || {};
    if (!G.enabled || !THREE.PMREMGenerator || !renderer || !renderer.setRenderTarget) return null;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    const domeG = new THREE.SphereGeometry(20, 32, 20);
    es.add(new THREE.Mesh(domeG, domeMat({ toneMapped: false, depthTest: true }, o.frameYaw || 0)));
    const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, toneMapped: false, fog: false });
    const cap0 = new THREE.Color(o.capHex != null ? o.capHex : 0x6d7a45).multiplyScalar(o.gb != null ? o.gb : 1);
    es.add(new THREE.Mesh(new THREE.SphereGeometry(19.5, 24, 12, 0, 6.2832, Math.PI / 2, Math.PI / 2), capMat));
    if (o.decorate) o.decorate(es);          // CLOUDS C3: the layer's sphere over the dome (the water reflects the clouds)
    let rt = null, bakedSun = null, bakedVer = -1, bakes = 0, lastMs = 0, lastBake = -1e9;
    const probe = {
      get texture() { return rt ? rt.texture : null; },
      get bakes() { return bakes; }, get lastMs() { return lastMs; },
      bake(day) {
        capMat.color.copy(cap0).multiplyScalar(groundIrradiance(day));
        const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
        const next = pmrem.fromScene(es, 0.035, 1, 100);
        lastMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
        const old = rt; rt = next; bakes++;
        if (o.onSwap) o.onSwap(rt.texture);
        if (old) old.dispose();
        bakedSun = day ? day.sun.slice() : [0, 1, 0]; bakedVer = day ? day.version : 0;
        lastBake = (typeof performance !== 'undefined') ? performance.now() : 0;
        if (o.baked) o.baked();
        return rt.texture;
      },
      // re-bake when the sun moved past the threshold (deg), the day's dials changed, or the decorator
      // says its layer moved (the clouds' drift - at most every o.minGapMs, 4 s by default)
      maybe(day, thresholdDeg) {
        if (!rt) return probe.bake(day);
        const s = day.sun, b = bakedSun;
        const cosA = Math.max(-1, Math.min(1, s[0] * b[0] + s[1] * b[1] + s[2] * b[2]));
        const moved = Math.acos(cosA) * 180 / Math.PI > (thresholdDeg || 1.5);
        if (moved || day.version !== bakedVer) return probe.bake(day);
        const now = (typeof performance !== 'undefined') ? performance.now() : 0;
        if (o.dirty && now - lastBake > (o.minGapMs || 4000) && o.dirty()) return probe.bake(day);
        return null;
      },
    };
    return probe;
  }

  return {
    P, setDay, medium: (h) => medium(h, newMed()), transmittance, T, MS, skyRadiance, skyIrradiance, sunTransmittance, groundIrradiance, makeProbe,
    bakeT, bakeMS, tUV, tFromUV, phaseMie, lut: () => ({ T: lutT, MS: lutMS, TW, TH, MW, MH }),
    init, update, domeMat, U, G, get enabled() { return G.enabled; },
    install, inject, setAP, get installed() { return installed; }, AP: { N: AP_N, W: AP_W, H: AP_H, DMAX: AP_DMAX, TILE: AP_TILE, TILE_Y: AP_TILE_Y, ATLAS_H: AP_ATLAS_H },
    MIST, apUniforms, GLSL: { MIST: MIST_GLSL, AP: AP_SAMPLE_GLSL },   // the clouds' pass shares the splice's samplers and functions
  };
})();
if (typeof window !== 'undefined') { window.ATMO = ATMO; ATMO.install(); }   // BEFORE any program compiles: the splice must be in every fogged material's chunks
if (typeof module !== 'undefined' && module.exports) module.exports = ATMO;
