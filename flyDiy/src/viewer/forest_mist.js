// ============================================================
// FOREST MIST — pockets of mist caught in the trees (PROTOTYPE, FOREST-MIST study, 2026-11-09)
//
// futureDesigns/FOREST-MIST-STUDY-2026-11.md is the document. OFF BY DEFAULT and nothing is created, uploaded or
// spliced unless the page carries ?fmist=<techniques>:
//   ?fmist=c    THE VEIL (every tier): the pockets as a second term in the mist the scene already applies on every
//               fogged material (atmo.js MIST_GLSL) - a few taps near the surface and near the eye. No draw, no pass.
//   ?fmist=a    THE POCKETS IN THE CLOUD MARCH (gamer / ultra): the same density marched by the clouds' pass
//               (clouds.js), lit by the clouds' sun and sky, composited through their depth-aware upsample.
//   ?fmist=b    THE CARDS (the user's "fakey" planes): soft camera-facing sheets anchored on the map's pockets, each a
//               procedurally animated noise drifting on the wind and fading at its anchor's edge - one instanced draw,
//               alpha-blended, depth-tested against the scene but NOT depth-faded (the main pass has no depth to read).
//   ?fmist=ac   both (the march takes the pockets in front of the scene; the veil then carries only the eye's pocket
//               - see the study SS4).
// One map serves both: WHERE mist can sit is baked once per world from the land (valley floors, forest, water,
// hollows); WHEN and HOW MUCH is the weather's (humidity, the burn-off, the wind's calm, the hours since rain, the
// cloud base); the NOISE drifts on the wind while the map stays put, so the wisps stream through a pocket and
// dissolve at its edges - the mist moves with the wind and stays where the valley holds it.
//
// THE MAP (512^2 RGBA half float, INTO ATMO's atlas: columns [768, 1280) of the tile rows - the clouds' tile owns
// [0, 512), the F2 mist field [512, 768); no new sampler, the island's ground programs stand at 15 of 16):
//   R  the canopy top (m ASL): the ground, plus the crowns where there is forest
//   G  POOL: how much a valley holds (radiation fog drains into hollows and sits under an inversion lid)
//   B  WISP: how much wet forest steams (after rain, the crowns breathe; a hollow or a gully more than a spur)
//   A  the valley floor (m ASL): the pool's lid is measured from it
// ============================================================
var FMIST = (function () {
  'use strict';
  let flag = '';
  try { flag = new URLSearchParams(location.search).get('fmist') || ''; } catch (e) {}
  const ON = /^[abc]+$/.test(flag);
  const A = ON && flag.indexOf('a') >= 0, B = ON && flag.indexOf('b') >= 0, C = ON && flag.indexOf('c') >= 0;
  // THE DIALS. Strength laws are in strengths(); `force` pins them for a rig ({pool, wisp, oro} 0..1, null = the weather's).
  const S = {
    N: 512, X: 768,                 // the map's side and its first column in the atlas
    // THE DENSITY (per metre at a full pocket's heart, the heaviest day) and its ladder: the user's A/B, 9-10 Nov - the flat
    // body with the weather on BOTH the amount and the density read best ("the finer ones"), and the dense end looked
    // bad, so the heaviest is 0.003 /m (~1.3 km inside: an aerial veil, never a wall) and the last wisps a quarter of it.
    rhoMax: 0.003, octaves: 2, flat: true, coreK: 1.6,   // coreK: the gradient mechanism's (flat: false), kept for the record
    rho: null,                      // a pin over the ladder (the rigs' density sheets), null = the weather's
    swing: 30, covK: 0.9, detailK: 9.0, erode: 0.5, soft: 0.5, stretch: 2.1,   // the contours' swing (m), the share of a full pocket that is mist, the erosion's scale (x the body's) and depth
    period: 110,                    // the noise's cell (m): a wisp a few tree lengths across (160 -> 110: the user, 10 Nov, "chase more resolution")
    lidM: 25, lidK: 110,            // the pool's lid over the valley floor: 25 m + 110 m x the pool weight
    wispLo: -12, wispHi: 40,        // the wisps' band about the canopy top (m)
    oroLo: -40, oroHi: 140,         // the cloud base's band (m) where it meets a slope
    driftK: 1,                      // x the wind
    surfN: 4, eyeN: 2, surfM: 450, eyeM: 350,   // the veil's taps: near the surface, near the eye (C)
    marchN: 28, marchKm: 3.5,       // the cloud pass's pocket segment (A)
    cards: 420, cardKm: 2.6, cardW: 120, cardH: 34, cardA: 2.4, cardEvery: 20,   // the cards (B): how many, how far, how big, how dense, re-dealt every N frames
    force: null,
    sunK: 0.5,                      // the beam's share (the layer's own colour already carries the sky)
    fwd: 2.2,                       // the pockets' forward lobe (fmFwd): x3.2 straight at the sun (4 clipped the backlit wisps to white)
    redistribute: 0.6,              // the flat layer gives this share of itself to the pockets while they are live (SS1: they redistribute, they do not add)
  };
  // what runs, live (a rig flips them; the flag says what was BUILT - a technique not in the flag cannot be turned on)
  const use = { a: A, b: B, c: C };
  const st = { bakeMs: 0, map: null, k: [0, 0, 0], drift: [0, 0], t: null, hoursDry: null };
  // ---- THE MAP, ON THE CPU (pure: node can bake it - the gate and the study's figures) ----------------------------
  function bakeMap(world, N) {
    N = N || S.N;
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const b = world.bounds, size = Math.max(b.x1 - b.x0, b.z1 - b.z0), step = size / N;
    const isl = world.island && world.island.canopyAt ? world.island : null;
    const SF = world.SURFACE || {};
    const g = new Float32Array(N * N), can = new Float32Array(N * N), wet = new Float32Array(N * N), fo = new Float32Array(N * N);
    const tH = world.terrainHBuild || world.terrainH, wH = world.waterHBuild || world.waterH;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = b.x0 + (i + 0.5) * step, z = b.z0 + (j + 0.5) * step, k = j * N + i;
      const h = tH(x, z), w = wH ? wH(x, z) : -1e9, water = w > h - 0.25 || h < 0.2;
      g[k] = water ? Math.max(w, 0) : h; wet[k] = water ? 1 : 0;
      let c = 0;
      if (!water) {
        if (isl) c = isl.canopyAt(x, z) || 0;
        else if (world.surface && world.surface(x, z) === SF.FOREST_FLOOR) c = 18;
      }
      can[k] = c; fo[k] = c > 3 ? Math.min(1, c / 14) : 0;
    }
    const at = (a, i, j) => a[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
    const sep = (a, R, f, init) => { const t = new Float32Array(N * N), o = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let m = init; for (let q = -R; q <= R; q++) m = f(m, at(a, i + q, j)); t[j * N + i] = m; }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let m = init; for (let q = -R; q <= R; q++) m = f(m, at(t, i, j + q)); o[j * N + i] = m; }
      return o; };
    const blur = (a, R) => { const s = sep(a, R, (m, v) => m + v, 0), n = (2 * R + 1) * (2 * R + 1); for (let k = 0; k < N * N; k++) s[k] /= n; return s; };
    const R6 = Math.max(1, Math.round(600 / step)), R9 = Math.max(1, Math.round(900 / step)), R2 = Math.max(1, Math.round(200 / step));
    const floor = blur(sep(g, R6, Math.min, 1e9), R2);              // the floor a hollow shares (atmo.js bakeField's rule)
    const ridge = blur(sep(g, R9, Math.max, -1e9), R2);             // the ridges round it
    const gb = blur(g, R2), gb2 = blur(g, R6);                       // the land at two scales: their difference is the hollow
    const wetB = blur(wet, R6);                                      // near water (a lake, the sea, a river's reach)
    const foB = blur(fo, Math.max(1, Math.round(120 / step)));      // forest, not a lone tree
    const px = new Float32Array(N * N * 4);
    let pool = 0, wisp = 0;
    for (let k = 0; k < N * N; k++) {
      const relief = Math.max(30, ridge[k] - floor[k]);
      const v = 1 - Math.min(1, Math.max(0, (g[k] - floor[k]) / (0.45 * relief)));   // 1 on the valley floor, 0 halfway up
      const hollow = Math.min(1, Math.max(0, (gb2[k] - gb[k]) / 40 + 0.5));         // > 0.5 a gully, < 0.5 a spur
      const lowAir = Math.exp(-Math.max(0, floor[k]) / 450);                         // cold air pools LOW (a 900 m saddle keeps a seventh)
      const P = v * lowAir * (0.45 + 0.55 * Math.max(foB[k], wetB[k])) * (wet[k] ? (g[k] < 0.5 ? 0.12 : 0.8) : 1);   // a lake steams, the open sea is the F2 layer's (and a plan's fog.hold)
      const Wp = foB[k] * (0.35 + 0.65 * hollow) * (0.7 + 0.3 * Math.min(1, wetB[k] * 3));
      px[k * 4] = g[k] + can[k];
      px[k * 4 + 1] = Math.min(1, P);
      px[k * 4 + 2] = Math.min(1, Wp);
      px[k * 4 + 3] = floor[k];
      pool += px[k * 4 + 1]; wisp += px[k * 4 + 2];
    }
    const ms = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0;
    return { N, x0: b.x0, z0: b.z0, inv: 1 / size, size, px, ms, poolMean: pool / (N * N), wispMean: wisp / (N * N) };
  }
  // ---- WHEN: the weather's law (CPU, per frame; pure in the day + the soil) ----------------------------------------
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function strengths(day, soil) {
    if (!day) return [0, 0, 0];
    const rh = day.rh != null ? day.rh : 0.5;
    const burn = day.mistBurn != null ? day.mistBurn : 0;           // 07_day: the LAGGED sun x the clear sky
    const calm = day.mistCalm != null ? day.mistCalm : 1;           // 07_day: the wind leaves this much of a layer (3-10 kt)
    const cov = day.cloudCoverEff != null ? day.cloudCoverEff : 0;
    const rainNow = soil ? soil.rainNow : (day.rain || 0);
    const hoursDry = soil ? soil.hoursDry : (rainNow > 0 ? 0 : 96);
    st.hoursDry = hoursDry;
    // THE SCALE: `rh` is the club's 2 m screen humidity, ~0.75-0.79 at dawn even on a mist morning (the plan's days,
    // measured: still-and-fair 0.78 at 05:00, the morning after the storm 0.76) - the forest floor and the valley bottom
    // are wetter than the screen. The thresholds sit on the GAME's scale, not on the forest's.
    // POOL - radiation / valley fog: a humid, calm, CLEAR night drains cold air into the hollows (an overcast keeps the
    // ground warm: no radiation fog under it); the lagged sun burns it off (the ground gives the heat back late).
    const pool = sm(0.70, 0.90, rh) * (1 - burn) * calm * (1 - 0.7 * sm(0.4, 0.9, cov));
    // WISP - the wet forest steaming: rain just stopped, the crowns evaporate; strongest when the first sun warms them
    // (so the burn takes it only half), a third left 8 h dry, gone after a day. Wind tears it (calm, softened).
    const wet = rainNow > 0.05 ? 0.6 : Math.exp(-Math.max(0, hoursDry) / 8) * (1 - sm(24, 36, hoursDry));   // and none a day and a half dry
    const wisp = sm(0.55, 0.80, rh) * wet * (1 - 0.5 * burn) * (0.4 + 0.6 * calm);
    // ORO - the cloud base on the slopes: the base IS the saturation, so it is keyed on how low the base sits (under
    // Jolene's ~1 km summits) and how covered the sky is, not on the screen humidity; drier air thins it. The wind does
    // not take it (upslope wind makes it).
    const base = day.cloudBase != null ? day.cloudBase : 1e4;
    const oro = sm(0.45, 0.8, cov) * (1 - sm(600, 1000, base)) * (0.5 + 0.5 * sm(0.75, 0.95, rh));
    // THE PLAN'S OWN FOG (WEATHER-SEASON's crafted days: `fog.hold` with `where`): a day that DECLARES valley fog
    // ('low': Valley fog, Morning fog on the sound, Valley fog late summer - 0.85-0.9 at dawn, gone by 10-11) fills the
    // pockets to the plan's hold whatever the humidity law says; a SEA fog day lends the lakes and the shore valleys a
    // little (the sea itself is the F2 layer's). The authored burn-off is the plan's: the law's own burn is not applied
    // on top of it.
    const P = day.plan;
    const hold = P && P.fogHold > 0 ? P.fogHold : 0;
    const poolPlan = !hold ? 0 : (P.fogWhere === 'sea' ? 0.35 * hold : hold);
    return [Math.max(pool, poolPlan), wisp, oro];
  }
  // ---- THE GPU SIDE: into the atlas, and the lanes -----------------------------------------------------------------
  function bake(renderer, world, scene) {
    if (!ON || !world) return null;
    const AT = (typeof ATMO !== 'undefined') ? ATMO : null;
    if (!AT || !AT.AP || !AT.blit) { console.warn('FMIST: no atlas blit'); return null; }
    const m = bakeMap(world, S.N);
    st.map = { N: m.N, x0: m.x0, z0: m.z0, inv: m.inv, poolMean: m.poolMean, wispMean: m.wispMean };
    st.bakeMs = m.ms;
    AT.blit(renderer, m.px, m.N, S.X, AT.AP.TILE_Y);
    if (B) cardsBuild(m, scene);
    console.log('forest mist: map ' + m.N + '^2 in ' + m.ms.toFixed(0) + ' ms (pool mean ' + m.poolMean.toFixed(3) + ', wisp mean ' + m.wispMean.toFixed(3) + ')');
    return st.map;
  }
  // update(day, eye, world): the strengths, the drift (an integral of the wind, as the F2 banks), into the mist's lanes
  function update(day, eye, world, soil) {
    if (!ON || typeof ATMO === 'undefined' || !ATMO.apUniforms) return;
    const L = ATMO.apUniforms.uMist.value;
    if (L.length < 52) return;
    const k = S.force ? [S.force.pool || 0, S.force.wisp || 0, S.force.oro || 0] : strengths(day, soil);
    st.k = k;
    const tNow = day ? (day.jd != null ? day.jd * 86400 : (day.utc || 0)) : 0;
    const dt = st.t == null ? 0 : Math.max(0, Math.min(600, tNow - st.t)); st.t = tNow;
    if (dt > 0 && world && world.climate && typeof world.climate.sample === 'function') {
      const f = world.climate.sample(eye ? eye.x : 0, 40, eye ? eye.z : 0, tNow, st._w || (st._w = {}));
      const v = (f && (f.wind || f.v || f)) || null;
      if (v && v.length >= 3) { st.drift[0] -= v[0] * dt * S.driftK; st.drift[1] -= v[2] * dt * S.driftK; st.wind = [v[0], v[2]]; }
    }
    const M = st.map;
    // THE DAY'S MOISTURE GATHERS INTO THE POCKETS: the flat layer (written by ATMO.update this frame, before us) thins
    // by the pockets' share, so the air between them clears. (F1's visibility contract reads MIST.rho0, the un-thinned
    // density: it errs on the side of drawing more, never of cutting what the eye can see.)
    if (use.a || use.c) L[0] *= 1 - S.redistribute * Math.min(1, Math.max(k[0], k[1], k[2]));
    L[28] = k[0]; L[29] = k[1]; L[30] = k[2]; L[31] = day && day.cloudBase != null ? day.cloudBase : 1e4;
    // the drift wraps on a multiple of the noise's period x 289 (the value noise's hash is not periodic, but the
    // float precision at 1e5 m is 8 mm - the wrap only keeps a week's drift small)
    const wrap = S.period * 4096;
    L[32] = st.drift[0] % wrap; L[33] = st.drift[1] % wrap; L[34] = rhoOf(Math.max(k[0], k[1], k[2]));
    L[35] = (M && (k[0] + k[1] + k[2]) > 0.002) ? 1 : 0;
    L[36] = M ? M.x0 : 0; L[37] = M ? M.z0 : 0; L[38] = M ? M.inv : 0; L[39] = 1 / S.period;
    if (B) { cardMesh && (cardMesh.visible = use.b); if (use.b) cardsUpdate(eye, k, st.wind || [1, 0]); }
    L[40] = C && use.c ? S.surfN : 0; L[41] = C && use.c ? S.eyeN : 0; L[42] = S.surfM; L[43] = S.eyeM;
    L[44] = A && use.a ? S.marchKm * 1000 : 0; L[45] = S.fwd; L[46] = S.flat ? 1 : 0;
    // the key's beam at the pockets (sun or moon, through the air to ~150 m), in the dome's units like the layer's colour
    if (L.length >= 52 && day && ATMO.sunTransmittance) {
      const key = (typeof SKY_LIGHT !== 'undefined' && SKY_LIGHT.isMoon) ? day.moon : day.sun;
      const up = key[1] > -0.02 ? 1 : 0, Tk = ATMO.sunTransmittance(0.15, Math.max(0.01, key[1]), st._T || (st._T = [0, 0, 0]));
      const moonK = (typeof SKY_LIGHT !== 'undefined' && SKY_LIGHT.isMoon && ATMO.U.eMoon) ? ATMO.U.eMoon.value : 1;
      const sc = ATMO.U.scale.value * up * moonK * S.sunK;
      L[48] = Tk[0] * sc; L[49] = Tk[1] * sc; L[50] = Tk[2] * sc; L[51] = 0;
    } L[46] = 0; L[47] = 0;   // the veil starts where the march stops (?fmist=ac)
  }
  // ---- B: THE CARDS ------------------------------------------------------------------------------------------------
  // The candidates are the map's texels that can hold a pocket; every cardEvery frames the nearest are dealt to the
  // instances (a hash keeps a texel's card the same card from deal to deal, so nothing pops while the eye is still).
  let cand = null, cardMesh = null, cardMat = null, cardFrame = 0;
  function cardsBuild(m, scene) {
    if (!B || !scene || typeof THREE === 'undefined' || typeof MATLIB === 'undefined') return;
    const L = [];
    const step = m.size / m.N;
    for (let j = 0; j < m.N; j++) for (let i = 0; i < m.N; i++) {
      const k = (j * m.N + i) * 4, P = m.px[k + 1], W = m.px[k + 2];
      if (P < 0.25 && W < 0.2) continue;
      const h = ((i * 73856093) ^ (j * 19349663)) >>> 0, r = (h % 1000) / 1000;
      if (r > 0.55) continue;                                             // thinned: a pocket, not a sheet
      const pool = P >= W;
      const y = pool ? m.px[k + 3] + S.lidM * 0.4 + S.lidK * 0.45 * P : m.px[k] + 4 + 10 * r;
      L.push({ x: m.x0 + (i + 0.5 + (r - 0.5)) * step, z: m.z0 + (j + 0.5 + ((h >> 10) % 1000 / 1000 - 0.5)) * step, y, w: pool ? P : W, kind: pool ? 0 : 1, ph: r });
    }
    cand = L;
    const geo = new THREE.PlaneGeometry(1, 1);
    const n = S.cards;
    geo.setAttribute('aCard', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));   // weight, kind, phase, size
    const U = { uMist: ATMO.apUniforms.uMist, uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0, 0) }, uK: { value: new THREE.Vector3() }, uA: { value: S.cardA }, uScale: ATMO.U.scale };
    cardMat = MATLIB.make(THREE, 'shader', { uniforms: U, transparent: true, depthWrite: false, depthTest: true, fog: false,
      vertexShader: `attribute vec4 aCard; uniform vec2 uWind; uniform float uTime; varying vec2 vUv; varying vec4 vC; varying float vFade; varying vec3 vW;
        void main() {
          vUv = uv; vC = aCard;
          // the card faces the eye about the vertical (a sheet stays level); it streams downwind through its anchor and back
          vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float L = 0.5 * aCard.w, s = fract(aCard.z + uTime * 0.004);
          vec2 off = uWind * (s - 0.5) * aCard.w * 1.2;
          c.xz += off;
          vFade = sin(3.14159 * s);                                    // born upwind, gone downwind
          vec3 toE = cameraPosition - c; vec3 r = normalize(vec3(toE.z, 0.0, -toE.x));
          vec3 wp = c + r * position.x * aCard.w + vec3(0.0, 1.0, 0.0) * position.y * aCard.w * ${(S.cardH / S.cardW).toFixed(3)};
          vW = wp; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `uniform vec4 uMist[13]; uniform vec3 uK; uniform float uA, uTime; varying vec2 vUv; varying vec4 vC; varying float vFade; varying vec3 vW;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
        void main() {
          vec2 q = vUv - 0.5; float r = length(q * vec2(1.0, 1.6));
          float edge = 1.0 - smoothstep(0.25, 0.5, r);
          vec2 p = vUv * vec2(3.0, 1.2) + vec2(vC.z * 17.0 + uTime * 0.01, vC.z * 5.0);
          float n = 0.55 * vn(p) + 0.3 * vn(p * 2.3 + 3.1) + 0.15 * vn(p * 5.1 - 1.7);
          float k = vC.y < 0.5 ? uK.x : uK.y;
          n = clamp(0.5 + (n - 0.5) * 2.6, 0.0, 1.0);
          float a = min(0.85, uA * min(1.0, 2.0 * vC.x) * k * edge * vFade * smoothstep(0.3, 0.7, n) * (1.0 - smoothstep(0.0, 0.5, -q.y) * 0.4));
          if (a < 0.003) discard;
          float c = max(0.0, dot(normalize(vW - cameraPosition), uMist[2].xyz));
          gl_FragColor = vec4(uMist[1].rgb + uMist[12].rgb * (0.25 + uMist[11].y * (0.35 * pow(c, 6.0) + pow(c, 40.0))), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    cardMesh = new THREE.InstancedMesh(geo, cardMat, n);
    cardMesh.frustumCulled = false; cardMesh.renderOrder = 3; cardMesh.count = 0;
    scene.add(cardMesh);
  }
  const _m4 = (typeof THREE !== 'undefined') ? new THREE.Matrix4() : null;
  function cardsUpdate(eye, k, wind) {
    if (!cardMesh || !cand || !eye) return;
    cardMat.uniforms.uK.value.set(k[0], k[1], k[2]);
    cardMat.uniforms.uTime.value = (st.t || 0);
    const wl = Math.hypot(wind[0], wind[1]) || 1; cardMat.uniforms.uWind.value.set(wind[0] / wl, wind[1] / wl);
    // re-dealt every cardEvery frames, AND at once when the strengths move or the deck is empty (the first sheet's cards
    // were switched on 5 frames before the still and the next deal was 13 frames away: an empty deck photographed)
    const kk = k.map(v => v.toFixed(2)).join(',');
    if ((cardFrame++ % S.cardEvery) !== 0 && kk === st.cardK && cardMesh.count > 0) return;
    st.cardK = kk;
    const R2 = (S.cardKm * 1000) ** 2, pick = [];
    for (const c of cand) { const d2 = (c.x - eye.x) ** 2 + (c.z - eye.z) ** 2; if (d2 < R2 && (c.kind === 0 ? k[0] : k[1]) > 0.01) pick.push([d2, c]); }
    pick.sort((a, b) => a[0] - b[0]);
    const n = Math.min(S.cards, pick.length), at = cardMesh.geometry.attributes.aCard;
    for (let i = 0; i < n; i++) {
      const c = pick[i][1];
      _m4.makeTranslation(c.x, c.y, c.z); cardMesh.setMatrixAt(i, _m4);
      at.array[i * 4] = c.w; at.array[i * 4 + 1] = c.kind; at.array[i * 4 + 2] = c.ph; at.array[i * 4 + 3] = S.cardW * (0.7 + 0.6 * c.ph) * (c.kind === 0 ? 1.4 : 1);
    }
    cardMesh.count = n; cardMesh.instanceMatrix.needsUpdate = true; at.needsUpdate = true;
    st.cards = n;
  }
  // ---- THE CPU MIRROR of fmDens (the GLSL's arithmetic; the calibration and the gate read it, never the page) -----
  const fr = x => x - Math.floor(x);
  const h21 = (x, y) => { let a = fr(x * 0.1031), b = fr(y * 0.1031), c = fr(x * 0.1031);   // fmH, the same arithmetic
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; return fr((a + b) * c); };
  const md = (v, n) => v - n * Math.floor(v / n);
  const vn = (x, y) => { x = md(x, 512); y = md(y, 512); const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const jx = md(ix + 1, 512), jy = md(iy + 1, 512);
    const a = h21(ix, iy), b = h21(jx, iy), c = h21(ix, jy), d = h21(jx, jy); return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; };
  const smc = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function densCPU(m, k, base, drift, x, y, z) {
    const i = Math.min(m.N - 1, Math.max(0, Math.floor((x - m.x0) * m.inv * m.N))), j = Math.min(m.N - 1, Math.max(0, Math.floor((z - m.z0) * m.inv * m.N)));
    const o = (j * m.N + i) * 4, top = m.px[o], G = m.px[o + 1], Bw = m.px[o + 2], fl = m.px[o + 3];
    const hc = y - top, lid = fl + S.lidM + S.lidK * G, yb = y - base;
    const inPool = k[0] * G > 0.002 && y < lid + 30 && hc > -30;
    const inWisp = k[1] * Bw > 0.002 && hc > S.wispLo - 15 && hc < S.wispHi + 30;
    const inOro = k[2] > 0.002 && yb > S.oroLo - 30 && yb < S.oroHi + 30 && hc > -20 && hc < 190;
    if (!(inPool || inWisp || inOro)) return 0;
    const qx = (x + drift[0]) / S.period + y * 0.011, qz = (z + drift[1]) / S.period - y * 0.007;
    let n = 0.55 * vn(qx, qz) + 0.30 * vn(qx * 2.31 + 5.2, qz * 2.31 + 1.3) + 0.15 * vn(qx * 5.3 - 3.1, qz * 5.3 + 7.7);
    n = Math.min(1, Math.max(0, 0.5 + (n - 0.5) * S.stretch));
    const sw = (n - 0.5) * S.swing, hcs = hc - sw;
    const gP = G * smc(0, 18, lid + sw - y) * (hc >= -30 ? 1 : 0);
    const gW = Bw * smc(S.wispLo, 0, hcs) * (1 - smc(8, S.wispHi, hcs));
    const gO = smc(S.oroLo, 0, yb - sw) * (1 - smc(60, S.oroHi, yb - sw)) * (1 - smc(40, 160, hc)) * (hc >= -20 ? 1 : 0);
    const cov = Math.min(1, k[0] * gP + k[1] * gW + k[2] * gO); if (cov <= 0.002) return 0;
    const geo = Math.max(k[0] > 0.002 ? gP : 0, k[1] > 0.002 ? gW : 0, k[2] > 0.002 ? gO : 0);
    const thr = 1 - S.covK * cov;
    let body = S.flat ? smc(thr, thr + S.soft, n) : Math.pow(Math.min(1, Math.max(0, (n - thr) / Math.max(0.05, 1 - thr))), S.coreK); if (body <= 0) return 0;
    const rx = qx * S.detailK + y * 0.045, rz = qz * S.detailK + 3.3;
    let e = 0.5 * vn(rx, rz) + 0.32 * vn(rx * 2.7 + 1.9, rz * 2.7 - 4.1) + 0.18 * vn(rx * 6.1 - 7.3, rz * 6.1 + 2.2); e = Math.min(1, Math.max(0, 0.5 + (e - 0.5) * 2.4));
    const dd = Math.min(1, Math.max(0, (body - e * S.erode) / (1 - e * S.erode)));
    return dd * (S.flat ? smc(0, 0.3, cov) : Math.sqrt(geo)) * (S.rho != null ? S.rho : S.rhoMax);
  }
  // THE INTENSITY IS THE LADDER (the user, 9 Nov, on the /2 /4 /8 /16 sheet: "they all look right to me in different
  // conditions. The /2 would be really, really heavy morning mist ... the other ones dissipating after rain"): the
  // density per metre falls an octave per half of the strength, from rhoMax (the heaviest morning: clear definition and
  // cuts) to rhoMax/4 (the last wisps, still cutting through the trees) - and the cover takes it to nothing below that.
  // S.rho, when set, pins it (a rig's ladder).
  // ...AND THEN THE USER SPLIT THEM (9 Nov, on the sheet where both moved together: "plain stuff"): the strength is the
  // AMOUNT only (the cover's threshold); the density at a core is fixed and the inside of a pocket carries the gradient.
  // `octaves` stays as the dial for a rig that wants the old coupling (0 = the user's ruling).
  const rhoOf = I => S.rho != null ? S.rho : S.rhoMax * Math.pow(2, -S.octaves * (1 - Math.min(1, Math.max(0, I))));
  const level = I => I >= 0.75 ? 'heavy' : I >= 0.4 ? 'mist' : I >= 0.1 ? 'wisps' : 'none';
  const stats = () => ({ level: level(Math.max(st.k[0], st.k[1], st.k[2])), rho: +rhoOf(Math.max(st.k[0], st.k[1], st.k[2])).toFixed(5), on: ON, use: Object.assign({}, use), cards: st.cards || 0, bakeMs: +st.bakeMs.toFixed(1), k: st.k.map(v => +v.toFixed(3)), hoursDry: st.hoursDry, drift: st.drift.map(v => Math.round(v)), map: st.map });
  // THE GLSL, shared by the veil (atmo.js MIST_GLSL) and the march (clouds.js): fmDens(p) per metre.
  // uMist[7] = (pool k, wisp k, oro k, cloud base m) | [8] = (drift x, z, rho, on) | [9] = (map x0, z0, 1/size, 1/period)
  // | [10] = (surface taps, eye taps, surface metres, eye metres) | [11] = (the veil's nearest distance: the march's reach under ?fmist=ac, the forward lobe's gain, 0, 0)
  // | [12] = (the key's beam at the pockets rgb, 0). The value noise is mistVN (MIST_GLSL's own).
  const GLSL = (AP_N_W, ATLAS_H, TILE_Y) => `
    // THE POCKETS' OWN VALUE NOISE, sin-free (Hoskins' hash12): the F2 layer's mistVN hashes with fract(sin(x) * 43758),
    // which fp32 cannot carry past a few thousand - the finer noise (110 m cells, a ~2 m octave) put its arguments at
    // 1e4-3e6 and the "random" lattice went smooth: big blobs where finer wisps were asked for (the sheet of 10 Nov).
    // The lattice is also wrapped to 512 cells (56 km at 110 m: never seen on the island) so the hash's input stays small.
    float fmH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float fmVN(vec2 p) {
      p = mod(p, 512.0);
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      vec2 j = mod(i + 1.0, 512.0);
      return mix(mix(fmH(i), fmH(vec2(j.x, i.y)), f.x), mix(fmH(vec2(i.x, j.y)), fmH(j), f.x), f.y);
    }
    vec4 fmMap(vec2 xz) {
      vec2 uv = clamp((xz - uMist[9].xy) * uMist[9].z, 0.0, 1.0);
      vec2 t = vec2((${S.X}.0 + 0.5 + uv.x * ${S.N - 1}.0) / ${AP_N_W}.0, (${TILE_Y}.0 + 0.5 + uv.y * ${S.N - 1}.0) / ${ATLAS_H}.0);
      return texture2D(uApAtlas, t);
    }
    float fmDens(vec3 p) {
      vec4 m = fmMap(p.xz);
      float hc = p.y - m.x;                                              // over the canopy (negative: in the crowns)
      float lid = m.w + ${S.lidM.toFixed(1)} + ${S.lidK.toFixed(1)} * m.y;   // the pool's flat top: the inversion
      float yb = p.y - uMist[7].w;
      // the reject before any noise: outside every band (with the contours' 30 m of swing) there is nothing to buy
      bool inPool = uMist[7].x * m.y > 0.002 && p.y < lid + 30.0 && hc > -30.0;
      bool inWisp = uMist[7].y * m.z > 0.002 && hc > ${(S.wispLo - 15).toFixed(1)} && hc < ${(S.wispHi + 30).toFixed(1)};
      bool inOro = uMist[7].z > 0.002 && yb > ${(S.oroLo - 30).toFixed(1)} && yb < ${(S.oroHi + 30).toFixed(1)} && hc > -20.0 && hc < 190.0;
      if (!(inPool || inWisp || inOro)) return 0.0;
      // THE BODY: the noise rides the wind, the map does not - wisps stream through a pocket and fade at its edges; a slow
      // vertical shear so a wisp leans. The octaves' sum sits at 0.5 +- 0.13, so it is stretched to the unit (x2.6).
      vec2 q = (p.xz + uMist[8].xy) * uMist[9].w + vec2(p.y * 0.011, -p.y * 0.007);
      float n = 0.55 * fmVN(q) + 0.30 * fmVN(q * 2.31 + vec2(5.2, 1.3)) + 0.15 * fmVN(q * 5.3 + vec2(-3.1, 7.7));
      n = clamp(0.5 + (n - 0.5) * ${S.stretch.toFixed(2)}, 0.0, 1.0);
      // THE CONTOURS (the user, 9 Nov: "lacks detail in the shape and the contours"): the bands' edges ride the noise, so
      // a wisp's top is lumpy and the pool's lid heaves instead of lying as a level slab
      float sw = (n - 0.5) * ${S.swing.toFixed(1)};
      float hcs = hc - sw;
      // THE PLACE'S OWN SHAPE (geometry: the map's weight x the band's profile, 0..1) and THE WEATHER'S AMOUNT are kept
      // apart (the user, 9 Nov: "the control for how much the slope holds is good, but now it's all too thick ...
      // controlling both together is lacking. It just gives you very plain stuff"): the weather sets how much of the
      // place is mist (the threshold); the shape and the noise set how dense it is inside (the gradient)
      float gP = m.y * smoothstep(0.0, 18.0, lid + sw - p.y) * step(-30.0, hc);
      float gW = m.z * smoothstep(${S.wispLo.toFixed(1)}, 0.0, hcs) * (1.0 - smoothstep(8.0, ${S.wispHi.toFixed(1)}, hcs));
      float gO = smoothstep(${S.oroLo.toFixed(1)}, 0.0, yb - sw) * (1.0 - smoothstep(60.0, ${S.oroHi.toFixed(1)}, yb - sw)) * (1.0 - smoothstep(40.0, 160.0, hc)) * step(-20.0, hc);
      float cov = min(1.0, uMist[7].x * gP + uMist[7].y * gW + uMist[7].z * gO);   // the weather's AMOUNT
      if (cov <= 0.002) return 0.0;
      float geo = max(uMist[7].x > 0.002 ? gP : 0.0, max(uMist[7].y > 0.002 ? gW : 0.0, uMist[7].z > 0.002 ? gO : 0.0));   // the place's own THICKNESS
      // THE GRADIENT THROUGH THE POCKET (the user: "the density vary through the cloud itself, less dense on the
      // borders"): from the threshold to the noise's top, so a wisp is thin at its edge and only its core is thick
      float thr = 1.0 - ${S.covK.toFixed(2)} * cov;
      // uMist[11].z = 1: THE FLAT MECHANISM kept for the A/B (the sheet the user asked to compare: a plain body that
      // saturates, the weather on both the amount and the density); 0: the gradient
      float body = uMist[11].z > 0.5 ? smoothstep(thr, thr + ${S.soft.toFixed(2)}, n)
                                     : pow(clamp((n - thr) / max(0.05, 1.0 - thr), 0.0, 1.0), ${S.coreK.toFixed(2)});
      if (body <= 0.0) return 0.0;
      // THE DETAIL: a ~${Math.round(S.period / S.detailK)} m erosion eats the edges (Schneider's remap: base minus the fine noise), so the
      // outline breaks into wisps and the inside keeps its mass
      vec2 r = q * ${S.detailK.toFixed(2)} + vec2(p.y * 0.045, 3.3);
      float e = 0.5 * fmVN(r) + 0.32 * fmVN(r * 2.7 + vec2(1.9, -4.1)) + 0.18 * fmVN(r * 6.1 + vec2(-7.3, 2.2));   // three octaves: the edge breaks at ~12, ~4.5 and ~2 m
      e = clamp(0.5 + (e - 0.5) * 2.4, 0.0, 1.0);
      float d = clamp((body - e * ${S.erode.toFixed(2)}) / (1.0 - e * ${S.erode.toFixed(2)}), 0.0, 1.0);
      return d * (uMist[11].z > 0.5 ? smoothstep(0.0, 0.3, cov) : sqrt(geo)) * uMist[8].z;
    }
    // A pocket is droplets (~10 um): Mie's forward peak is narrow and strong - backlit by a low sun the mist glows
    // (the concept art's whole light); side- and front-lit it is the layer's own colour. uMist[11].y = the lobe's gain.
    float fmFwd(vec3 d) { float c = max(0.0, dot(d, uMist[2].xyz)); return 1.0 + uMist[11].y * (0.35 * pow(c, 6.0) + pow(c, 40.0)); }
    // THE POCKETS' LIGHT: droplets scatter the sun's BEAM (uMist[12].rgb: the key's colour at the mist, x the scale), not the
    // horizontal irradiance the F2 layer is lit by (x sin(el): 0.1 at dawn, which made a front-lit pocket grey) - a
    // quarter of it to the side and behind, the forward lobe toward the key - plus the layer's own sky light
    vec3 fmCol(vec3 d) { float c = max(0.0, dot(d, uMist[2].xyz));
      return uMist[1].rgb + uMist[12].rgb * (0.25 + uMist[11].y * (0.35 * pow(c, 6.0) + pow(c, 40.0))); }
    // THE VEIL (?fmist=c): the pockets' optical depth along the eye's ray to a surface D metres off - a few taps on
    // the last stretch before the surface (the pocket the trees stand in) and the first after the eye (the pocket the
    // eye is in). What a pocket hanging half-way between the two does to a far ridge is missed: the study's SS3c.
    float fmOD(vec3 o, vec3 d, float D) {
      if (uMist[8].w < 0.5 || D > 25000.0 || D < uMist[11].x) return 0.0;
      float od = 0.0, Ls = min(D, uMist[10].z), ns = max(1.0, uMist[10].x), dts = Ls / ns;
      for (int i = 0; i < 8; i++) { if (float(i) >= uMist[10].x) break; od += fmDens(o + d * (D - (float(i) + 0.5) * dts)) * dts; }
      if (D > Ls && uMist[10].y > 0.5) {
        float Le = min(D - Ls, uMist[10].w), dte = Le / max(1.0, uMist[10].y);
        for (int i = 0; i < 4; i++) { if (float(i) >= uMist[10].y) break; od += fmDens(o + d * ((float(i) + 0.5) * dte)) * dte; }
      }
      return od;
    }`;
  return { ON, A, B, C, S, use, densCPU, rhoOf, level, bakeMap, strengths, bake, update, stats, GLSL };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FMIST;
