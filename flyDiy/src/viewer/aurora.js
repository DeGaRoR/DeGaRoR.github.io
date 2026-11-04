// aurora.js - THE AURORA, FIRST CUT (NIGHT-LOOK step 5; the user 4 Nov: "the cabin could be lit, plus the aurora and the plane")
// The study (flydiy-notes/NIGHT-LOOK-STUDY-2026-11.md 1.5) wants a curtain march into a small sky texture; this is its
// point 8, the analytic band: draped curtains written straight in azimuth and elevation, one fragment per sky pixel, no
// target and no pass. A sphere riding the camera right after the dome (opaque list, renderOrder -999, additive, no depth: the
// world draws over it), and the same material in the reflection probes' bake scenes, so the water and the skin reflect it.
// OFF unless asked (AURORA.on()): nothing is built, no program compiled, no cost; no game path calls it yet - the photo rig does.
// The level is authored to the EXPOSURE like the town's lamps (P / the true exposure x level: the same on screen whatever the
// night's stop), fading in over 2^8..2^12 of exposure, so never by day or at blue hour. `az` is a dial: stylised, a real
// aurora's azimuth follows the magnetic pole. Procedural only - no asset.
(function () {
  if (typeof window === 'undefined') return;
  const W = window;
  const DEF = { level: 0.9, azDeg: 0, wideDeg: 95, baseDeg: 8, heightDeg: 11, t: -1 };   // t >= 0: the curtains' clock held, so a selected shot comes back the same
  const D = Object.assign({}, DEF);
  const U = { uK: { value: 0 }, uT: { value: 0 }, uAz: { value: 0 }, uWide: { value: 1 }, uBase: { value: 0.1 }, uHgt: { value: 0.1 } };
  const VS = `
    varying vec3 vDir;
    void main() {
      vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const FS = `
    varying vec3 vDir;
    uniform float uK, uT, uAz, uWide, uBase, uHgt;
    float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
    float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
    float fbm(float x) { return 0.5 * n1(x) + 0.3 * n1(x * 2.13 + 3.1) + 0.2 * n1(x * 4.37 + 7.7); }
    // ONE SHEET (the user 4 Nov: "for the sake of the screenshot"; previewed by a hand port on the CPU). The rays run up the magnetic field and converge on the
    // magnetic zenith, so the azimuth spreads toward the top of the fan; a ray's own reach tears the top into a drapery; a thin magenta hem under the green, teal above it, violet at the top
    vec3 sheet(float az, float el, float seed, float base, float hgt, float s, float soft) {
      float da0 = atan(sin(az - uAz), cos(az - uAz));
      float u = uAz + da0 * (1.0 + 0.9 * max(el, 0.0));
      float fold = 0.030 * sin(u * 5.1 + seed + uT * 0.02) + 0.020 * sin(u * 14.3 + seed * 2.1 - uT * 0.03) + 0.024 * (fbm(u * 21.0 + seed + uT * 0.012) - 0.5) + 0.009 * (fbm(u * 83.0 + seed * 3.0) - 0.5);
      float x = (el - base - fold) / hgt;
      float w = 0.6 * fbm(u * 16.0 + seed + uT * 0.01);
      float rA = n1(u * 210.0 + seed * 3.0 + w * 9.0 + uT * 0.03), rB = n1(u * 640.0 + seed * 5.0 + w * 23.0 - uT * 0.02), rC = fbm(u * 58.0 + seed * 9.0 + uT * 0.015);
      float reach = 0.55 + 1.5 * rC * rC + 0.5 * rA;
      float lower = smoothstep(-0.03 - soft, 0.015 + soft, x), upper = exp(-max(x, 0.0) * 2.6 / reach);
      float rays = 0.07 + 0.95 * rA * rA + 0.8 * rB * rB * rB;
      float along = smoothstep(0.42, 0.56, fbm(u * 7.0 + seed * 7.0 + uT * 0.006)), bright = 0.6 + 1.0 * pow(n1(u * 37.0 + seed * 2.0 + uT * 0.02), 3.0);
      float I = lower * upper * rays * along * bright * s * (1.0 + 1.3 * exp(-max(x, 0.0) * 7.0));   // the curtain is brightest just over its hem
      float hem = (1.0 - smoothstep(-0.03, 0.03, x)) * max(1.0 - soft * 4.0, 0.0), top = smoothstep(0.25, 0.95, x / reach), mid = smoothstep(0.2, 0.9, x / reach);
      vec3 col = mix(vec3(0.06, 1.0, 0.2), vec3(0.03, 0.8, 0.42), mid);
      col = mix(col, vec3(0.62, 0.12, 0.8), top);
      col = mix(col, vec3(0.9, 0.16, 0.6), hem * 0.8);
      return col * I;
    }
    void main() {
      vec3 d = normalize(vDir);
      if (d.y <= 0.0 || uK <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      float az = atan(d.x, -d.z), el = asin(d.y), da = abs(atan(sin(az - uAz), cos(az - uAz)));
      float mask = 1.0 - smoothstep(uWide * 0.5, uWide, da);
      vec3 c = sheet(az, el, 1.3, uBase, uHgt, 1.0, 0.0) + sheet(az, el, 4.7, uBase + 0.05, uHgt * 0.9, 0.6, 0.12) + sheet(az, el, 9.1, uBase - 0.024, uHgt * 0.5, 0.6, 0.02) + sheet(az, el, 13.3, uBase + 0.13, uHgt * 1.2, 0.22, 0.3);
      // the veil: the display's soft light in the air around the bright rays
      float v = 0.06 * smoothstep(0.0, 0.12, el) * exp(-max(el - 0.1, 0.0) * 3.6) * (0.5 + 0.8 * fbm(az * 3.0 + 2.0 + uT * 0.004));
      c += vec3(0.12, 0.9, 0.5) * v;
      gl_FragColor = vec4(c * mask * smoothstep(0.0, 0.03, d.y) * uK, 1.0);
    }`;
  let meshes = [], mat = null, cam = null;
  const put = () => {
    U.uAz.value = D.azDeg / 57.29578; U.uWide.value = D.wideDeg / 57.29578; U.uBase.value = D.baseDeg / 57.29578; U.uHgt.value = D.heightDeg / 57.29578;
  };
  // every frame it draws: x P, over the true exposure (pre-ok: the level carries P)
  const tick = () => {
    const ex = (W.GFX && W.GFX.exposureBase && W.GFX.exposureBase()) || 1, P = (W.LIGHT_RIG && W.LIGHT_RIG.P) ? W.LIGHT_RIG.P() : 1;
    const t = Math.max(0, Math.min(1, (Math.log2(Math.max(1, ex)) - 8) / 4));
    U.uK.value = D.level * t * t * (3 - 2 * t) * P / Math.max(0.92, ex);
    U.uT.value = D.t >= 0 ? D.t : (W.performance ? W.performance.now() : 0) / 1000;
  };
  const addTo = (parent, radius, order) => {
    const T = W.THREE, m = new T.Mesh(new T.SphereGeometry(radius, 48, 24), mat);
    m.renderOrder = order; m.frustumCulled = false; m.onBeforeRender = tick;
    parent.add(m); meshes.push(m); return m;
  };
  const AURORA = {
    defaults: () => Object.assign({}, DEF), dials: () => Object.assign({}, D), get on_() { return meshes.length > 0; },
    // on({ camera, azDeg, ... }): the sphere on the camera and in the probes' scenes (ATMO.probes), and one cut bake of each
    on(o) {
      o = o || {};
      for (const k of Object.keys(DEF)) if (typeof o[k] === 'number') D[k] = o[k];
      put();
      if (meshes.length) return true;
      const T = W.THREE; cam = o.camera || (W.FLIGHT_PROBE && W.FLIGHT_PROBE.camera && W.FLIGHT_PROBE.camera());
      if (!T || !cam) return false;
      mat = new T.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, side: T.BackSide, blending: T.AdditiveBlending, transparent: false, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
      addTo(cam, 1.9, -999);
      const probes = (W.ATMO && W.ATMO.probes) || [], day = W.DAY_CLOCK && W.DAY_CLOCK.day ? W.DAY_CLOCK.day() : null;
      tick();
      for (const p of probes) { if (!p.scene) continue; addTo(p.scene, 18, 5); if (day) { try { p.bake(day, true); } catch (e) { console.warn('aurora bake:', e && e.message); } } }
      return true;
    },
    off() { for (const m of meshes) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); } meshes = []; if (mat) { mat.dispose(); mat = null; } },
  };
  W.AURORA = AURORA;
})();
