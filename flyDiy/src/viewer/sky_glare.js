// ============================================================
// THE SUN'S GLARE — the flare over the frame (SKY S7, 2026-09-15).
//
// Not a bloom pass: the resolve pass owns no colour (GATE AA), and a
// frame-wide blur on a 1.25x target buys one thing this does directly.
// What reads as the sun's glare is the SUN: (1) the corona in the dome
// shader (atmo.js, the eye's own 1/theta^2 scatter round a disc ten
// thousand times the sky) and (2) THIS - a soft glow that bleeds over the
// wing's edge, a few ghosts down the line to the frame's centre and a thin
// streak, drawn as additive quads on the canvas after the resolve, in
// display space, and GATED ON OCCLUSION: five rays from the eye toward the
// sun (the centre and four at a third of a degree) against the aeroplane's
// skin, the shed when in it, and the terrain's profile along the sun's
// azimuth - the fraction that gets through is the flare's strength, eased
// so a strut crossing the disc does not blink it. The moon gets a faint one.
//
// Dials: GRAPHICS `sun glare` (off / on, user-facing), F8 atmosphere fold
// `glare` (the corona) / `flare` (the glow) / `ghosts`.
// ============================================================
var SKY_GLARE = (function () {
  'use strict';
  const S = { on: true, glow: 1, ghosts: 1, streak: 1 };
  let scene = null, cam = null, ready = false, occluders = () => [], terrainH = null;
  let vis = 0, frame = 0, ndc = { x: 0, y: 0, ok: false };
  const quads = [];
  const VERT = `varying vec2 vQ; uniform vec2 uPos, uSize; void main(){ vQ = position.xy; gl_Position = vec4(uPos + position.xy * uSize, 0.0, 1.0); }`;
  const FRAG = `varying vec2 vQ; uniform vec3 uCol; uniform float uI, uKind;
    void main(){
      float r = length(vQ);
      float a;
      if (uKind < 0.5) a = pow(max(0.0, 1.0 - r), 2.5) + 0.35 * pow(max(0.0, 1.0 - r * 0.6), 6.0);        // the glow: a soft core with a wide skirt
      else if (uKind < 1.5) a = smoothstep(1.0, 0.7, r) * (0.55 + 0.45 * smoothstep(0.55, 0.85, r));         // a ghost: a soft disc with a brighter rim
      else a = max(0.0, 1.0 - abs(vQ.y) * 9.0) * pow(max(0.0, 1.0 - abs(vQ.x)), 1.6);                       // the streak
      gl_FragColor = vec4(uCol * uI * a, 1.0);
    }`;
  const _ray = { o: null };
  function init() {
    if (ready || typeof THREE === 'undefined') return ready;
    scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    const mk = (kind, col, size, t, gain) => {
      const m = new THREE.ShaderMaterial({ uniforms: { uPos: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(size, size) }, uCol: { value: new THREE.Color(col) }, uI: { value: 0 }, uKind: { value: kind } },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
      const q = new THREE.Mesh(geo, m); q.frustumCulled = false; scene.add(q);
      quads.push({ q, m, kind, size, t, gain });
    };
    // the glow at the sun, the ghosts along the line to the centre (t = 0 the sun, 1 the centre), the streak
    mk(0, 0xffe9c8, 0.42, 0, 1.0);
    mk(2, 0xffe2c0, 0.75, 0, 0.35);
    mk(1, 0xffc07a, 0.05, 0.35, 0.10); mk(1, 0x9ad0ff, 0.09, 0.55, 0.07); mk(1, 0xffe08a, 0.03, 0.72, 0.12);
    mk(1, 0x8fffc8, 0.14, 1.15, 0.05); mk(1, 0xff9c9c, 0.06, 1.45, 0.08);
    _ray.o = new THREE.Raycaster(); _ray.o.far = 8000;
    ready = true;
    return true;
  }
  const V3 = () => ((typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : null);
  const _v = V3(), _d = V3();
  // one ray: the aeroplane / the shed by raycast, the terrain by its profile along the ray
  function rayClear(origin, dir) {
    const occ = occluders() || [];
    if (occ.length && _ray.o) {
      _ray.o.set(origin, dir);
      const hits = _ray.o.intersectObjects(occ, true);
      for (const h of hits) if (h.object.visible && h.distance > 0.3) return false;
    }
    if (terrainH && dir.y < 0.35) {
      let t = 40;
      for (let i = 0; i < 14; i++) { const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t; if (terrainH(x, z) > y) return false; t *= 1.7; }
    }
    return true;
  }
  // update(camera, dir (THREE.Vector3 world unit vector), o: { lum (the light's transmittance, 0..1), isMoon, phase, aspect })
  function update(camera, dir, o) {
    if (!init() || !camera) return;
    frame++;
    const lum = o.lum != null ? o.lum : 1;
    // the light's place on screen
    _v.copy(dir).multiplyScalar(5000).add(camera.position).project(camera);
    const behind = _v.z > 1 || dir.dot(camera.getWorldDirection(_d)) < 0;
    ndc.x = _v.x; ndc.y = _v.y; ndc.ok = !behind && Math.abs(_v.x) < 1.6 && Math.abs(_v.y) < 1.6;
    // the occlusion fraction every third frame, eased
    if (ndc.ok && (frame % 3) === 0) {
      let clear = 0;
      const e = 0.006;   // a third of a degree
      const ups = [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e]];
      for (const [ax, ay] of ups) {
        _d.copy(dir); _d.x += ax; _d.y += ay; _d.normalize();
        if (rayClear(camera.position, _d)) clear++;
      }
      const target = clear / ups.length;
      vis += (target - vis) * 0.35;
    } else if (!ndc.ok) vis *= 0.8;
    const aspect = o.aspect || 1;
    const I = (S.on ? 1 : 0) * vis * (o.isMoon ? 0.18 * (o.phase || 0) : 1) * Math.pow(Math.max(0.03, Math.min(1, lum)), 0.6);
    // the tint: the light's transmitted colour
    for (const g of quads) {
      const gain = g.kind === 1 ? S.ghosts : g.kind === 2 ? S.streak : S.glow;
      g.m.uniforms.uI.value = I * g.gain * gain * (g.kind === 2 && aspect < 1 ? 0.6 : 1);
      const px = ndc.x * (1 - g.t), py = ndc.y * (1 - g.t);
      g.m.uniforms.uPos.value.set(px, py);
      g.m.uniforms.uSize.value.set(g.size / aspect * (g.kind === 2 ? 2.2 * aspect : 1), g.size);
      if (o.tint && g.kind !== 1) g.m.uniforms.uCol.value.setRGB(0.6 + 0.4 * o.tint[0], 0.6 + 0.4 * o.tint[1], 0.6 + 0.4 * o.tint[2]);
    }
  }
  function render(renderer) {
    if (!ready || !S.on || vis < 0.01 || !ndc.ok) return;
    const ac = renderer.autoClear, rt = renderer.getRenderTarget();
    renderer.autoClear = false; renderer.setRenderTarget(null);
    renderer.render(scene, cam);
    renderer.setRenderTarget(rt); renderer.autoClear = ac;
  }
  const API = { S, init, update, render, setOccluders: f => { occluders = f; }, setTerrain: f => { terrainH = f; }, get visible() { return vis; }, get ndc() { return ndc; } };
  if (typeof window !== 'undefined') window.SKY_GLARE = API;
  return API;
})();
