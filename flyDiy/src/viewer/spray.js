// spray.js — THE SPRAY (H7.1, G460.9): the white water the hull throws, drawn as lit, soft,
// motion-stretched sprites - not points.
//
// What the field cannot hold - the water that leaves the surface - is particles: the twin
// fans a planing float throws off its chines, the burst of a touchdown, the mist that hangs
// over a splash. They were THREE.Points: 0.1 m squares, additive white, unlit - the one thing
// in the water that read as 2005 (the user: "little white squares"). What holds now, from the
// state of the art (the whitewater of Sea of Thieves / Triton / the Niagara ships: sprites
// with a soft, noisy alpha, lit as a scattering medium, stretched along their motion, a
// short-lived droplet kind and a slow mist kind):
//   - ONE InstancedBufferGeometry quad batch (a draw), the corners built in VIEW space so a
//     sprite always faces the eye and its size is metres in perspective;
//   - MOTION STRETCH: the quad's long axis follows the particle's screen velocity, its length
//     size + |v| x uStretch (a 12 m/s droplet is a 0.3 m streak; a resting puff a disc) -
//     the thrown read of spray without a trail texture;
//   - the SPRITE is procedural: a soft disc torn by two octaves of value noise seeded per
//     particle (no media, no atlas) - the puff's edge is never a circle;
//   - LIT AS WHITE WATER: a scattering medium under the sky - albedo 0.9 x (the sun's
//     irradiance x a WRAPPED N.L on the sprite's sphere normal + the sky's hemisphere) / pi,
//     the same Lambert the foam gets in water.js, plus a forward-scatter lobe when the sun
//     is behind the spray (the backlit fan that glows white on a real run);
//   - alpha-blended (not additive: white water is opaque-ish and additive spray glows over a
//     dark sea), depth-tested (the LOG depth chunks are spliced in: the renderer runs a
//     logarithmic depth buffer and a ShaderMaterial without them writes a linear depth into it
//     - every sprite failed the test against the water and nothing drew), no depth write, fading in over the first tenth of its life and
//     out over the last 40 %, growing with age (a droplet cloud expands as it falls).
//   Two kinds: DROPLETS (kind 0: 1-4 cm radius, 0.6-1.0 s, ballistic, streaked) and PUFFS (kind 1:
//   0.2-0.5 m, 1.2-2.0 s, drag-damped, near-weightless mist that hangs where the splash was;
//   few - a first cut at 0.9 m and one per 7 droplets buried the floats in a cloud, h7v/run6).
// The emitters and the integration stay in app.js (syncWaterFx - the hydro's own numbers);
// this module owns the draw. Cost: one draw of <= 1200 quads, ~0.05 ms.
//
//   SPRAY.make(THREE, n)      -> { mesh, n, set(i, p, v, age01, size, seed, kind), hide(i),
//                                  commit(), light(sunDir, sunCol, skyCol), dispose() }
'use strict';
(function () {
  const VERT = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iA;   // iA: age01, size (m), seed, kind
    uniform float uStretch;
    varying vec2 vUv; varying vec4 vA;
    void main() {
      vUv = uv; vA = iA;
      vec4 vp = modelViewMatrix * vec4(iPos, 1.0);
      vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
      // the long axis along the screen velocity, the short across; a slow particle is a disc
      float sp = length(vv.xy);
      vec2 ax = sp > 0.05 ? vv.xy / sp : vec2(1.0, 0.0);
      vec2 ay = vec2(-ax.y, ax.x);
      float s = iA.y;
      float len = s + min(0.35, sp * uStretch) * (iA.w < 0.5 ? 1.0 : 0.15);
      vec2 c = (uv - 0.5);
      vp.xy += ax * c.x * len * 2.0 + ay * c.y * s * 2.0;
      gl_Position = projectionMatrix * vp;
      #include <logdepthbuf_vertex>
    }`;
  const FRAG = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec2 vUv; varying vec4 vA;
    uniform vec3 uSunV; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform float uOpacity;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main() {
      #include <logdepthbuf_fragment>
      vec2 q = vUv * 2.0 - 1.0;
      float d2 = dot(q, q);
      if (d2 > 1.0) discard;
      float age = vA.x, seed = vA.z, kind = vA.w;
      // the sprite: a soft disc torn by noise - more torn for a puff, and the tear drifts with age
      vec2 np = vUv * (kind < 0.5 ? 3.0 : 4.5) + seed * 37.0 + age * 0.8;
      float n = 0.65 * vnoise(np) + 0.35 * vnoise(np * 2.3 + 11.0);
      float tear = kind < 0.5 ? smoothstep(0.15, 0.9, n) : smoothstep(0.18, 0.75, n * (1.0 - 0.35 * d2));
      float disc = smoothstep(1.0, kind < 0.5 ? 0.25 : 0.05, d2);
      float fade = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.6, 1.0, age));
      float a = disc * tear * fade * uOpacity * (kind < 0.5 ? 0.45 : 0.24) * (0.6 + 0.4 * hash(vec2(seed, 3.1)));   // every particle its own density
      if (a < 0.004) discard;
      // lit as white water: a sphere normal on the sprite, the sun wrapped, the sky's hemisphere,
      // and a forward-scatter lobe when the sun is behind it
      vec3 N = normalize(vec3(q, sqrt(max(0.0, 1.0 - d2)) * 0.8 + 0.2));
      float ndl = dot(N, uSunV) * 0.5 + 0.5;
      vec3 V = vec3(0.0, 0.0, 1.0);
      float back = pow(max(0.0, dot(-uSunV, V)), 6.0);
      vec3 col = 0.9 * (uSunCol * 0.65 * (0.25 + 0.75 * ndl * ndl) + uSkyCol * 0.9) / 3.14159265;   // thin water: two thirds of the foam's sun
      col += uSunCol * back * 0.12 * (1.0 - disc * 0.5);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function make(THREE, n) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.setIndex(base.getIndex()); g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), A = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { pos[i * 3 + 1] = -1e4; }
    const aP = new THREE.InstancedBufferAttribute(pos, 3), aV = new THREE.InstancedBufferAttribute(vel, 3), aA = new THREE.InstancedBufferAttribute(A, 4);
    aP.setUsage(THREE.DynamicDrawUsage); aV.setUsage(THREE.DynamicDrawUsage); aA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', aP); g.setAttribute('iVel', aV); g.setAttribute('iA', aA);
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      uniforms: { uStretch: { value: 0.014 }, uSunV: { value: new THREE.Vector3(0, 0, 1) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, uOpacity: { value: 1 } } });
    mat.toneMapped = true;
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 4;
    const sunW = new THREE.Vector3();
    const api = {
      mesh, n,
      set(i, p, v, age01, size, seed, kind) { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; vel[i * 3] = v[0]; vel[i * 3 + 1] = v[1]; vel[i * 3 + 2] = v[2]; A[i * 4] = age01; A[i * 4 + 1] = size; A[i * 4 + 2] = seed; A[i * 4 + 3] = kind; },
      hide(i) { pos[i * 3 + 1] = -1e4; A[i * 4 + 1] = 0; },
      commit() { aP.needsUpdate = true; aV.needsUpdate = true; aA.needsUpdate = true; },
      // light(sunDir (world, toward the sun), sunCol (irradiance), skyCol (the hemisphere's), camera): the view-space sun
      light(sunDir, sunCol, skyCol, camera) {
        sunW.set(sunDir[0], sunDir[1], sunDir[2]).normalize();
        if (camera) sunW.transformDirection(camera.matrixWorldInverse);
        mat.uniforms.uSunV.value.copy(sunW);
        if (sunCol) mat.uniforms.uSunCol.value.copy(sunCol);
        if (skyCol) mat.uniforms.uSkyCol.value.copy(skyCol);
      },
      set opacity(v) { mat.uniforms.uOpacity.value = v; }, get opacity() { return mat.uniforms.uOpacity.value; },
      material: mat,
      dispose() { g.dispose(); mat.dispose(); },
    };
    return api;
  }

  // ---- THE CHINE SHEETS (G460.10, the user: "the chine sheets") --------------------------------------
  // A planing float throws its spray as two thin SHEETS off the chines, not as a cloud: the water the
  // bottom meets along the spray-root line leaves tangentially, flares out and a little up, and falls
  // back a few metres aft, breaking into droplets along its edge. Each sheet is a parametric surface -
  // u along the wet chine (the root line, NU stations of the hull's own chine vertices), v the time of
  // flight (NV rows): p(u, v) = root(u) + out x (uo t) + up x (uu t - g t^2 / 2), t = v T, T = 2 uu / g -
  // built on the CPU every frame (4 sheets x 8 x 6 = 192 vertices) into ONE BufferGeometry, drawn by a
  // material of the sprites' family: procedural streaks along v torn by noise, thinning toward the edge
  // and the root's ends, lit as white water, alpha-blended, log-depth. The droplets peel off the sheet's
  // far edge (app.js emits them at v = 1 with the sheet's velocity); the puffs stay under it.
  //   SPRAY.makeSheets(THREE, n, NU, NV) -> { mesh, n, NU, NV, set(i, rootPts, out, up, uo, uu, strength), hide(i), commit(), light(...), dispose() }
  const SHEET_VERT = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 aQ;             // u, v, strength
    varying vec3 vQ; varying vec3 vN;
    void main() {
      vQ = aQ;
      vN = normalize(normalMatrix * normal);
      vec4 vp = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * vp;
      #include <logdepthbuf_vertex>
    }`;
  const SHEET_FRAG = `
    precision highp float;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec3 vQ; varying vec3 vN;
    uniform vec3 uSunV; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform float uOpacity; uniform float uTime;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main() {
      #include <logdepthbuf_fragment>
      float u = vQ.x, v = vQ.y, s = vQ.z;
      // the sheet: solid near the root, streaking and tearing toward its edge; the streaks run with the flow
      vec2 np = vec2(u * 14.0, v * 2.5 - uTime * 2.0);
      float streak = 0.55 * vnoise(np) + 0.3 * vnoise(np * vec2(2.0, 1.3) + 7.0) + 0.15 * vnoise(np * vec2(4.0, 1.0) + 3.0);
      float body = 1.0 - smoothstep(0.35, 1.0, v);                     // thins along the flight
      float tear = smoothstep(0.25 + 0.55 * v, 0.9, streak);             // torn more the farther out
      float ends = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.85, u); // the root line's ends feather
      float a = (0.25 + 0.75 * body) * mix(1.0, tear, smoothstep(0.1, 0.6, v)) * ends * s * uOpacity * 0.85;
      if (a < 0.004) discard;
      vec3 N = gl_FrontFacing ? vN : -vN;
      float ndl = dot(N, uSunV) * 0.5 + 0.5;
      float back = pow(max(0.0, dot(-uSunV, vec3(0.0, 0.0, 1.0))), 6.0);
      vec3 col = 0.9 * (uSunCol * 0.65 * (0.3 + 0.7 * ndl) + uSkyCol * 0.9) / 3.14159265 + uSunCol * back * 0.1;
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function makeSheets(THREE, n, NU, NV) {
    NU = NU || 8; NV = NV || 6;
    const per = NU * NV, g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * per * 3), nrm = new Float32Array(n * per * 3), q = new Float32Array(n * per * 3);
    for (let i = 0; i < n * per; i++) pos[i * 3 + 1] = -1e4;
    const idx = [];
    for (let s = 0; s < n; s++) for (let iu = 0; iu + 1 < NU; iu++) for (let iv = 0; iv + 1 < NV; iv++) {
      const a = s * per + iu * NV + iv, b = a + NV;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    const aP = new THREE.BufferAttribute(pos, 3), aN = new THREE.BufferAttribute(nrm, 3), aQ = new THREE.BufferAttribute(q, 3);
    aP.setUsage(THREE.DynamicDrawUsage); aN.setUsage(THREE.DynamicDrawUsage); aQ.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', aP); g.setAttribute('normal', aN); g.setAttribute('aQ', aQ);
    const mat = new THREE.ShaderMaterial({ vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      uniforms: { uSunV: { value: new THREE.Vector3(0, 0, 1) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, uOpacity: { value: 1 }, uTime: { value: 0 } } });
    mat.toneMapped = true;
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 3;
    const sunW = new THREE.Vector3(), G = 9.81;
    const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
    const api = {
      mesh, n, NU, NV,
      // set(i, roots, out, up, uo, uu, strength): roots = NU points [x, y, z] along the chine (fore to aft),
      // out/up unit vectors, uo/uu the sheet's outward and upward speeds (m/s), strength 0..1 (the pressure's)
      set(i, roots, out, up, uo, uu, strength) {
        const T = Math.max(0.05, 2 * uu / G), o = i * per;
        for (let iu = 0; iu < NU; iu++) {
          const r = roots[iu];
          for (let iv = 0; iv < NV; iv++) {
            const v = iv / (NV - 1), t = v * T, k = o + iu * NV + iv;
            const ho = uo * t, hv = uu * t - 0.5 * G * t * t;
            pos[k * 3] = r[0] + out[0] * ho + up[0] * hv; pos[k * 3 + 1] = r[1] + out[1] * ho + up[1] * hv; pos[k * 3 + 2] = r[2] + out[2] * ho + up[2] * hv;
            q[k * 3] = iu / (NU - 1); q[k * 3 + 1] = v; q[k * 3 + 2] = strength;
          }
        }
        // the normal: the sheet's tangents crossed (along u by the roots, along v by the flight)
        for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
          const k = o + iu * NV + iv, ku = o + Math.min(NU - 1, iu + 1) * NV + iv, ku0 = o + Math.max(0, iu - 1) * NV + iv, kv = o + iu * NV + Math.min(NV - 1, iv + 1), kv0 = o + iu * NV + Math.max(0, iv - 1);
          tmpA[0] = pos[ku * 3] - pos[ku0 * 3]; tmpA[1] = pos[ku * 3 + 1] - pos[ku0 * 3 + 1]; tmpA[2] = pos[ku * 3 + 2] - pos[ku0 * 3 + 2];
          tmpB[0] = pos[kv * 3] - pos[kv0 * 3]; tmpB[1] = pos[kv * 3 + 1] - pos[kv0 * 3 + 1]; tmpB[2] = pos[kv * 3 + 2] - pos[kv0 * 3 + 2];
          let nx = tmpA[1] * tmpB[2] - tmpA[2] * tmpB[1], ny = tmpA[2] * tmpB[0] - tmpA[0] * tmpB[2], nz = tmpA[0] * tmpB[1] - tmpA[1] * tmpB[0];
          const L = Math.hypot(nx, ny, nz) || 1; nrm[k * 3] = nx / L; nrm[k * 3 + 1] = ny / L; nrm[k * 3 + 2] = nz / L;
        }
      },
      hide(i) { const o = i * per; for (let k = 0; k < per; k++) { pos[(o + k) * 3 + 1] = -1e4; q[(o + k) * 3 + 2] = 0; } },
      commit(t) { aP.needsUpdate = true; aN.needsUpdate = true; aQ.needsUpdate = true; if (t != null) mat.uniforms.uTime.value = t; },
      light(sunDir, sunCol, skyCol, camera) {
        sunW.set(sunDir[0], sunDir[1], sunDir[2]).normalize();
        if (camera) sunW.transformDirection(camera.matrixWorldInverse);
        mat.uniforms.uSunV.value.copy(sunW);
        if (sunCol) mat.uniforms.uSunCol.value.copy(sunCol);
        if (skyCol) mat.uniforms.uSkyCol.value.copy(skyCol);
      },
      material: mat,
      dispose() { g.dispose(); mat.dispose(); },
    };
    return api;
  }
  // the two kinds' laws, read by app.js's emitters and integration (one keeper)
  const KIND = {
    droplet: { id: 0, life: [0.6, 1.0], size: [0.012, 0.04], grow: 1.6, drag: 0.25, gravity: 1.0 },   // size = the sprite's RADIUS, m
    puff:    { id: 1, life: [1.2, 2.0], size: [0.2, 0.5], grow: 2.0, drag: 2.2, gravity: 0.12 },
  };
  const SPRAY = { make, makeSheets, KIND, GLSL: { vert: VERT, frag: FRAG, sheetVert: SHEET_VERT, sheetFrag: SHEET_FRAG } };
  if (typeof window !== 'undefined') window.SPRAY = SPRAY;
  if (typeof module !== 'undefined' && module.exports) module.exports = SPRAY;
})();
